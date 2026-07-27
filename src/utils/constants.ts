/** Shared runtime constants. */

/**
 * Data repository (owner/name) this app reads from and writes inbox/ to.
 * Note: this is the DATA repo, not the app-code repo — a PAT must grant
 * Contents access to THIS repo or every data read fails.
 */
export const DATA_REPO = 'doroper98/worklog_log'

/**
 * TTL for caches that change frequently (slates, followups, month listings,
 * weekly reports). Kept in one place so every service ages content the same way.
 */
export const CACHE_TTL = 5 * 60 * 1000
