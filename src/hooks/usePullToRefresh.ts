import { useEffect, useRef, useState, type RefObject } from 'react'

interface UsePullToRefreshOptions {
  /** The scrollable container to attach listeners to */
  scrollRef: RefObject<HTMLElement | null>
  /** Async refresh handler */
  onRefresh: () => Promise<void> | void
  /** Distance at which the refresh fires (default 70 px) */
  threshold?: number
  /** Disable the gesture (default true) */
  enabled?: boolean
}

interface UsePullToRefreshResult {
  /** Current pull distance in px (0 when idle) */
  distance: number
  /** True while onRefresh is in-flight */
  refreshing: boolean
  /** Threshold passed through for the indicator */
  threshold: number
}

/**
 * Touch-based pull-to-refresh. Only engages when the container is
 * already scrolled to the top. Applies rubber-band damping.
 */
export function usePullToRefresh({
  scrollRef,
  onRefresh,
  threshold = 70,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!enabled) return
    const el = scrollRef.current
    if (!el) return

    let startY: number | null = null
    let currentDistance = 0
    let isRefreshing = false

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return
      if (el.scrollTop > 0) return
      startY = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY === null || isRefreshing) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        if (currentDistance !== 0) {
          currentDistance = 0
          setDistance(0)
        }
        return
      }
      // Rubber-band damping, capped at 1.5x threshold
      const damped = Math.min(dy * 0.5, threshold * 1.5)
      currentDistance = damped
      setDistance(damped)
      if (dy > 8 && e.cancelable) e.preventDefault()
    }

    const onTouchEnd = () => {
      if (startY === null) return
      startY = null
      if (currentDistance >= threshold) {
        isRefreshing = true
        setRefreshing(true)
        setDistance(threshold)
        Promise.resolve(onRefreshRef.current()).finally(() => {
          isRefreshing = false
          currentDistance = 0
          setRefreshing(false)
          setDistance(0)
        })
      } else {
        currentDistance = 0
        setDistance(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [scrollRef, enabled, threshold])

  return { distance, refreshing, threshold }
}
