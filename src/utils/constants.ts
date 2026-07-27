/** Shared runtime constants. */

/**
 * TTL for caches that change frequently (slates, followups, month listings,
 * weekly reports). Kept in one place so every service ages content the same way.
 */
export const CACHE_TTL = 5 * 60 * 1000
