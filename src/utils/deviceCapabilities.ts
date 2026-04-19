import type { GlassPerf } from '@/types'

/**
 * Detect device capability tier for Liquid Glass rendering.
 * Sets data-glass-perf attribute on <html> for CSS fallback.
 *
 * Tiers (per SPEC v5 §6.14):
 *   full  — all blur effects enabled
 *   low   — blur reduced to 10px (hardwareConcurrency <= 4 or deviceMemory <= 2)
 *   none  — blur disabled entirely (deviceMemory <= 1)
 */
export function detectGlassPerf(): GlassPerf {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    hardwareConcurrency?: number
  }

  const memory = nav.deviceMemory ?? 8
  const cores = nav.hardwareConcurrency ?? 8

  if (memory <= 1) return 'none'
  if (memory <= 2 || cores <= 4) return 'low'
  return 'full'
}

/** Apply glass perf tier to the document */
export function applyGlassPerf(perf: GlassPerf): void {
  if (perf === 'full') {
    document.documentElement.removeAttribute('data-glass-perf')
  } else {
    document.documentElement.setAttribute('data-glass-perf', perf)
  }
}
