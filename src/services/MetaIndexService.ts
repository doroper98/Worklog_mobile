import { GitHubClient } from '@/services/GitHubClient'
import type { FileContent } from '@/types'

/** Single entry from meta-index.json */
export interface MetaIndexEntry {
  date: string
  slateId: string | null
  title: string
  type: string
  people: string[]
  projects: string[]
  issues: string[]
  decisions: string[]
  keywords: string[]
  summary: string
}

/** Decode base64 content from GitHub API as UTF-8 */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

let cachedEntries: MetaIndexEntry[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 min

export const MetaIndexService = {
  /** Fetch and parse meta-index.json, with caching */
  async getEntries(): Promise<MetaIndexEntry[]> {
    if (cachedEntries && Date.now() - cacheTimestamp < CACHE_TTL) {
      return cachedEntries
    }

    try {
      const file = await GitHubClient.getContents('meta-index.json')
      if (Array.isArray(file)) return []

      let decoded: string
      const fc = file as FileContent
      if (fc.content) {
        decoded = decodeBase64Utf8(fc.content)
      } else if (fc.sha) {
        decoded = await GitHubClient.getBlob(fc.sha)
      } else {
        return []
      }

      const json = JSON.parse(decoded)
      const raw: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : Array.isArray(json.entries) ? json.entries : []

      cachedEntries = raw.map((e) => ({
        date: String(e.date ?? ''),
        slateId: e.slateId != null ? String(e.slateId) : null,
        title: String(e.title ?? ''),
        type: String(e.type ?? ''),
        people: Array.isArray(e.people) ? e.people.map(String) : [],
        projects: Array.isArray(e.projects) ? e.projects.map(String) : [],
        issues: Array.isArray(e.issues) ? e.issues.map(String) : [],
        decisions: Array.isArray(e.decisions) ? e.decisions.map(String) : [],
        keywords: Array.isArray(e.keywords) ? e.keywords.map(String) : [],
        summary: String(e.summary ?? ''),
      }))
      cacheTimestamp = Date.now()
      return cachedEntries
    } catch {
      return cachedEntries ?? []
    }
  },

  /** Build a Set of slateIds that have been ingested */
  async getIngestedSlateIds(): Promise<Set<string>> {
    const entries = await this.getEntries()
    const ids = new Set<string>()
    for (const e of entries) {
      if (e.slateId) ids.add(e.slateId)
    }
    return ids
  },

  /** Find meta-index entry by slateId */
  async findBySlateId(slateId: string): Promise<MetaIndexEntry | null> {
    const entries = await this.getEntries()
    return entries.find((e) => e.slateId === slateId) ?? null
  },

  /** Find daily aggregation entry for a date */
  async findDailyForDate(date: string): Promise<MetaIndexEntry | null> {
    const entries = await this.getEntries()
    return entries.find((e) => e.date === date && e.type === 'daily') ?? null
  },

  /** Drop cached entries so the next call fetches fresh */
  clearCache(): void {
    cachedEntries = null
    cacheTimestamp = 0
  },
} as const
