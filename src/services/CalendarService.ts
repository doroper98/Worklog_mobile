import { GitHubClient } from '@/services/GitHubClient'

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

/** Cache for followup dates */
let followupCache: { dates: Set<string>; fetchedAt: number } | null = null

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
    if (cached) return cached

    try {
      const file = await GitHubClient.getContents(path)

      if (!Array.isArray(file) && file.content) {
        const decoded = atob(file.content.replace(/\n/g, ''))
        const json = JSON.parse(decoded) as {
          slates: { id: string; type: string; title: string; createdAt: string; updatedAt: string }[]
        }

        const slates: SlateEntry[] = (json.slates ?? []).map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))

        slateCache.set(path, slates)
        return slates
      }
    } catch {
      // File not found or parse error
    }

    return []
  },

  /** Fetch followup dates (days with incomplete followups) */
  async getFollowupDates(): Promise<Set<string>> {
    if (followupCache && Date.now() - followupCache.fetchedAt < CACHE_TTL) {
      return followupCache.dates
    }

    const dates = new Set<string>()

    try {
      const file = await GitHubClient.getContents('config/followups.json')

      if (!Array.isArray(file) && file.content) {
        const decoded = atob(file.content.replace(/\n/g, ''))
        const json = JSON.parse(decoded) as {
          items: { sourceDate: string; completed: boolean; status: string }[]
        }

        for (const item of json.items ?? []) {
          if (!item.completed && item.status !== 'done') {
            if (item.sourceDate) {
              dates.add(item.sourceDate)
            }
          }
        }
      }
    } catch {
      // File not found or parse error
    }

    followupCache = { dates, fetchedAt: Date.now() }
    return dates
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
