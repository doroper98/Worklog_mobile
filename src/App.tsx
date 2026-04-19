import { ThemeProvider, useThemeContext } from '@/components/primitives/ThemeProvider'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { ThemeSetting } from '@/types'

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
  { value: 'system', label: '시스템 자동' },
]

function AppShell() {
  const { setting, effectiveTheme, setTheme, glassPerf } = useThemeContext()

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Radial wash — per theme */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 60% at 50% 0%, var(--color-accent-soft), transparent 60%)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 p-8">
        {/* Wordmark */}
        <div className="text-center">
          <h1
            className="font-display text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            Workwiki Mobile
          </h1>
          <p
            className="mt-1 font-mono text-xs uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}
          >
            PWA Scaffold · M1
          </p>
        </div>

        {/* Theme switcher */}
        <LiquidGlassSurface level={1} className="rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text-sec)' }}
            >
              테마
            </span>
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-surface-alt)' }}>
              {THEME_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-colors"
                  style={{
                    background: setting === value ? 'var(--color-accent)' : 'transparent',
                    color: setting === value ? 'var(--color-accent-text-on)' : 'var(--color-text-muted)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </LiquidGlassSurface>

        {/* Status */}
        <div
          className="flex flex-col items-center gap-1 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <span>Theme: {effectiveTheme} (setting: {setting})</span>
          <span>Glass: {glassPerf}</span>
        </div>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
