import { GitHubClient } from '@/services/GitHubClient'
import { CACHE_TTL } from '@/utils/constants'

/** One processed-record entry from inbox/_state.json (§3.6). */
export interface ProcessedRecord {
  originalPath: string
  processedAt: string
  action: 'promote' | 'append' | 'discard'
  journalDate?: string
  slateId?: string
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

interface StateCache {
  byPath: Map<string, ProcessedRecord>
  fetchedAt: number
}

let cache: StateCache | null = null

/**
 * Reads inbox/_state.json — the single index the desktop writes when it
 * promotes inbox memos into journals. One API call tells the mobile app what
 * happened to every memo it sent (§3.6).
 */
export const InboxStatusService = {
  /** Map of originalPath → processed record. Empty when _state.json is absent. */
  async getProcessedMap(): Promise<Map<string, ProcessedRecord>> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) return cache.byPath

    const byPath = new Map<string, ProcessedRecord>()
    try {
      const file = await GitHubClient.getContents('inbox/_state.json')
      if (!Array.isArray(file)) {
        let decoded: string | null = null
        if (file.content) decoded = decodeBase64Utf8(file.content)
        else if (file.sha) decoded = await GitHubClient.getBlob(file.sha)

        if (decoded) {
          const json = JSON.parse(decoded) as { processed?: ProcessedRecord[] }
          for (const rec of json.processed ?? []) {
            if (rec.originalPath) byPath.set(rec.originalPath, rec)
          }
        }
      }
    } catch {
      // 404 (no _state.json yet) or parse error → treat as nothing processed.
    }

    cache = { byPath, fetchedAt: Date.now() }
    return byPath
  },

  clearCache(): void {
    cache = null
  },
}
