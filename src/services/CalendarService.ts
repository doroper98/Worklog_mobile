import { GitHubClient } from '@/services/GitHubClient'

/** Decode base64 content from GitHub API as UTF-8 */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

export interface DayFile {
  name: string
  path: string
  sha: string
}

/** Parsed slate entry from journal JSON */
export interface SlateEntry {
  id: string
  type: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

/** Followup item from config/followups.json */
export interface FollowupItem {
  id: string
  description: string
  sourceDate: string
  status: string
  completed: boolean
  dueDate: string | null
}

export interface MonthData {
  /** Set of day numbers (1-31) that have journal files */
  daysWithFiles: Set<number>
  /** Map from day number to list of files */
  filesByDay: Map<number, DayFile[]>
  /** Fetch timestamp for cache staleness */
  fetchedAt: number
}

/** Cache TTL: 1 day */
const CACHE_TTL = 24 * 60 * 60 * 1000

/** In-memory cache keyed by "YYYY/MM" */
const cache = new Map<string, MonthData>()

/** Cache for parsed slates keyed by file path */
const slateCache = new Map<string, SlateEntry[]>()

/** Cache for followup data */
let followupCache: { items: FollowupItem[]; dates: Set<string>; fetchedAt: number } | null = null

/**
 * CalendarService — fetches journals/YYYY/MM/ tree to determine
 * which days have journal files written.
 *
 * File naming convention: journals/YYYY/MM/DD.json
 */
export const CalendarService = {
  /**
   * Get month data (days with files + file list per day).
   * Returns from cache if fresh, otherwise fetches from GitHub.
   */
  async getMonthData(year: number, month: number): Promise<MonthData> {
    const mm = String(month).padStart(2, '0')
    const key = `${year}/${mm}`

    const cached = cache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached
    }

    const data = await this.fetchMonthData(year, month)
    cache.set(key, data)
    return data
  },

  /** Fetch from GitHub API */
  async fetchMonthData(year: number, month: number): Promise<MonthData> {
    const mm = String(month).padStart(2, '0')
    const path = `journals/${year}/${mm}`

    const daysWithFiles = new Set<number>()
    const filesByDay = new Map<number, DayFile[]>()

    try {
      const entries = await GitHubClient.getContents(path)

      if (Array.isArray(entries)) {
        console.log(`[Month] ${path} → ${entries.length} entries:`, entries.map((e: { name: string; type: string }) => `${e.name}(${e.type})`))
        for (const entry of entries) {
          if (entry.type !== 'file') continue

          // Extract day from filename: DD.json
          const dayMatch = entry.name.match(/^(\d{2})\.json$/)
          if (!dayMatch) continue

          const day = parseInt(dayMatch[1], 10)
          if (day < 1 || day > 31) continue

          daysWithFiles.add(day)

          const existing = filesByDay.get(day) ?? []
          existing.push({
            name: entry.name,
            path: entry.path,
            sha: entry.sha,
          })
          filesByDay.set(day, existing)
        }
        console.log(`[Month] daysWithFiles:`, [...daysWithFiles].sort((a, b) => a - b))
      }
    } catch (err) {
      // 404 means no files for this month — not an error
      if (err instanceof Error && err.message.includes('404')) {
        // Empty month, return empty data
      } else {
        throw err
      }
    }

    return { daysWithFiles, filesByDay, fetchedAt: Date.now() }
  },

  /** Fetch and parse slates from a journal JSON file */
  async getSlatesForDay(year: number, month: number, day: number): Promise<SlateEntry[]> {
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const path = `journals/${year}/${mm}/${dd}.json`

    const cached = slateCache.get(path)
    if (cached) {
      console.log(`[Slate] cache hit ${path} → ${cached.length} slates`)
      return cached
    }

    try {
      const file = await GitHubClient.getContents(path)

      if (!Array.isArray(file) && file.content) {
        const decoded = decodeBase64Utf8(file.content)
        const json = JSON.parse(decoded) as Record<string, unknown>

        console.log(`[Slate] ${path} keys:`, Object.keys(json))

        // Support multiple JSON structures:
        // v3: { slates: [...] }
        // v2: { entries: [...] }
        // legacy: top-level array
        let rawSlates: Record<string, unknown>[]

        if (Array.isArray(json)) {
          rawSlates = json as Record<string, unknown>[]
        } else if (Array.isArray(json.slates)) {
          rawSlates = json.slates as Record<string, unknown>[]
        } else if (Array.isArray(json.entries)) {
          rawSlates = json.entries as Record<string, unknown>[]
        } else {
          console.warn(`[Slate] Unknown structure for ${path}:`, Object.keys(json))
          rawSlates = []
        }

        console.log(`[Slate] ${path} → ${rawSlates.length} raw slates`)
        if (rawSlates.length > 0) {
          console.log(`[Slate] first item keys:`, Object.keys(rawSlates[0]))
        }

        const slates: SlateEntry[] = rawSlates.map((s) => ({
          id: String(s.id ?? ''),
          type: String(s.type ?? 'memo'),
          title: String(s.title ?? s.name ?? ''),
          content: String(s.content ?? s.body ?? s.text ?? ''),
          createdAt: String(s.createdAt ?? s.created_at ?? s.date ?? ''),
          updatedAt: String(s.updatedAt ?? s.updated_at ?? s.date ?? ''),
        }))

        slateCache.set(path, slates)
        return slates
      } else {
        console.warn(`[Slate] No content in response for ${path}`, file)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('404')) {
        console.error(`[Slate] Error fetching ${path}:`, msg)
      }
    }

    return []
  },

  /** Fetch and cache all followup items */
  async fetchFollowups(): Promise<{ items: FollowupItem[]; dates: Set<string> }> {
    if (followupCache && Date.now() - followupCache.fetchedAt < CACHE_TTL) {
      return followupCache
    }

    const items: FollowupItem[] = []
    const dates = new Set<string>()

    try {
      const file = await GitHubClient.getContents('config/followups.json')

      if (!Array.isArray(file) && file.content) {
        const decoded = decodeBase64Utf8(file.content)
        const json = JSON.parse(decoded) as {
          items: {
            id: string; description: string; sourceDate: string
            status: string; completed: boolean; dueDate: string | null
          }[]
        }

        for (const raw of json.items ?? []) {
          items.push({
            id: raw.id,
            description: raw.description,
            sourceDate: raw.sourceDate,
            status: raw.status,
            completed: raw.completed,
            dueDate: raw.dueDate,
          })
          if (!raw.completed && raw.status !== 'done' && raw.sourceDate) {
            dates.add(raw.sourceDate)
          }
        }
      }
    } catch {
      // File not found or parse error
    }

    followupCache = { items, dates, fetchedAt: Date.now() }
    return { items, dates }
  },

  /** Get dates with pending followups (for calendar dots) */
  async getFollowupDates(): Promise<Set<string>> {
    const { dates } = await this.fetchFollowups()
    return dates
  },

  /** Get pending followup items for a specific date */
  async getPendingFollowupsForDate(dateStr: string): Promise<FollowupItem[]> {
    const { items } = await this.fetchFollowups()
    return items.filter(
      (it) => !it.completed && it.status !== 'done' && it.sourceDate === dateStr,
    )
  },

  /** Invalidate cache for a specific month */
  invalidate(year: number, month: number): void {
    const mm = String(month).padStart(2, '0')
    cache.delete(`${year}/${mm}`)
  },

  /** Clear all cached data */
  clearCache(): void {
    cache.clear()
    slateCache.clear()
    followupCache = null
  },
} as const
