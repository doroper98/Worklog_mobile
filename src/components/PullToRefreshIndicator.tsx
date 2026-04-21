interface Props {
  distance: number
  refreshing: boolean
  threshold: number
}

/**
 * Visual indicator for pull-to-refresh. Absolute-positioned,
 * must sit inside a `position: relative` container.
 */
export function PullToRefreshIndicator({ distance, refreshing, threshold }: Props) {
  const visible = refreshing || distance > 0
  if (!visible) return null

  const reached = distance >= threshold
  const progress = Math.min(distance / threshold, 1)
  const accentColor = reached || refreshing ? 'var(--color-accent)' : 'var(--color-text-muted)'

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center justify-center"
      style={{
        top: 0,
        height: refreshing ? threshold : distance,
        transition: refreshing ? 'none' : 'height 0.18s ease-out',
        opacity: Math.max(progress, refreshing ? 1 : 0.3),
      }}
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: 'var(--color-surface)',
          boxShadow: 'var(--glass-shadow)',
          color: accentColor,
          animation: refreshing ? 'workwiki-spin 0.9s linear infinite' : undefined,
        }}
      >
        {refreshing ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={accentColor} strokeWidth={2.4} strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
            stroke={accentColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
            style={{
              transform: `rotate(${reached ? 180 : progress * 180}deg)`,
              transition: 'transform 0.12s ease-out',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </div>
    </div>
  )
}
