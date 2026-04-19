import { useEffect, useState } from 'react'

import type { GlassPerf } from '@/types'
import { detectGlassPerf, applyGlassPerf } from '@/utils/deviceCapabilities'

/**
 * Detect and apply Liquid Glass performance tier on mount.
 * Returns the current tier so components can conditionally render.
 */
export function useLiquidGlass(): GlassPerf {
  const [perf, setPerf] = useState<GlassPerf>('full')

  useEffect(() => {
    const detected = detectGlassPerf()
    setPerf(detected)
    applyGlassPerf(detected)
  }, [])

  return perf
}
