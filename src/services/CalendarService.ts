import { GitHubClient } from '@/services/GitHubClient'

export interface DayFile {
  name: string
  path: string
  sha: string
}

export interface MonthData {
  /** Set of day numbers (1-31) that have markdown files */
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

/**
 * CalendarService — fetches markdown/YYYY/MM/ tree to determine
 * which days have markdown files written.
 *
 * File naming convention: markdown/YYYY/MM/DD_{slateId}.md
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
    const path = `markdown/${year}/${mm}`

    const daysWithFiles = new Set<number>()
    const filesByDay = new Map<number, DayFile[]>()

    try {
      const entries = await GitHubClient.getContents(path)

      if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (entry.type !== 'file' || !entry.name.endsWith('.md')) continue

          // Extract day from filename: DD_something.md or DD.md
          const dayMatch = entry.name.match(/^(\d{2})/)
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

  /** Invalidate cache for a specific month */
  invalidate(year: number, month: number): void {
    const mm = String(month).padStart(2, '0')
    cache.delete(`${year}/${mm}`)
  },

  /** Clear all cached data */
  clearCache(): void {
    cache.clear()
  },
} as const
