import { CalendarService } from '@/services/CalendarService'
import { MetaIndexService } from '@/services/MetaIndexService'
import { SearchIndex } from '@/services/SearchIndex'

/** Workbox runtime cache name for GitHub API responses (see vite.config.ts) */
const GITHUB_API_CACHE = 'github-api'

/**
 * Wipe every layer that could hold stale GitHub content:
 * Service Worker runtime cache + all in-memory service caches.
 *
 * Safe to call from user-facing actions (pull-to-refresh). Errors
 * from cache deletion are swallowed so a failed SW cache clear
 * never blocks the rest of the refresh.
 */
export async function clearAllCaches(): Promise<void> {
  if (typeof caches !== 'undefined') {
    try {
      await caches.delete(GITHUB_API_CACHE)
    } catch {
      // Ignore — cache may not exist yet
    }
  }
  CalendarService.clearCache()
  MetaIndexService.clearCache()
  SearchIndex.clearIndex()
}
