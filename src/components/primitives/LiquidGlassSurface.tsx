/**
 * LiquidGlassSurface — reusable glass chrome wrapper.
 *
 * Levels (from WW26Theme.jsx):
 *   1 = standard (search bar, week strip)     — blur 28px
 *   2 = elevated (tab bar)                    — blur 28px + strong shadow
 *   3 = sheet (bottom sheet, modal)           — blur 40px
 *
 * Automatically includes specular highlight.
 * Falls back to opaque background via CSS when blur is unsupported.
 */

interface LiquidGlassSurfaceProps {
  level?: 1 | 2 | 3
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

const LEVEL_CLASS: Record<1 | 2 | 3, string> = {
  1: 'liquid-glass',
  2: 'liquid-glass-elevated',
  3: 'liquid-glass-sheet',
}

export function LiquidGlassSurface({
  level = 1,
  className = '',
  style,
  children,
}: LiquidGlassSurfaceProps) {
  return (
    <div className={`${LEVEL_CLASS[level]} ${className}`} style={style}>
      <span className="liquid-glass-highlight" />
      {children}
    </div>
  )
}
