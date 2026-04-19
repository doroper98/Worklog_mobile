import { useCallback } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { useThemeContext } from '@/components/primitives/ThemeProvider'
import { AuthManager } from '@/services/AuthManager'
import type { ThemeSetting, GlassPerf } from '@/types'
import { applyGlassPerf } from '@/utils/deviceCapabilities'

// ─── Types ──────────────────────────────────────────────────────────────

interface SettingsViewProps {
  onTabSelect: (tab: string) => void
  onLogout: () => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

// ─── Section ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div
        className="mb-2 px-1 font-mono text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {title}
      </div>
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({
  label,
  detail,
  active,
  onTap,
  last,
  danger,
}: {
  label: string
  detail?: string
  active?: boolean
  onTap?: () => void
  last?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onTap}
      className="flex w-full items-center justify-between border-none bg-transparent px-4 py-3 text-left"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-hairline)',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      <span
        className="text-[14px] font-medium"
        style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        {detail && (
          <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            {detail}
          </span>
        )}
        {active && (
          <Icon name="check" size={16} color="var(--color-accent)" sw={2.5} />
        )}
      </div>
    </button>
  )
}

// ─── Tab bar ────────────────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  return (
    <LiquidGlassSurface
      level={2}
      className="absolute left-3.5 right-3.5 z-40 flex h-16 items-center justify-around overflow-hidden rounded-tab px-1.5"
      style={{ bottom: 'calc(14px + var(--sai-bottom, 0px))' }}
    >
      {TAB_ITEMS.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent"
            style={{ color: on ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
          >
            {on && (
              <span
                className="absolute top-1.5 h-1 w-1 rounded-full"
                style={{ background: 'var(--color-accent)' }}
              />
            )}
            <Icon name={t.icon} size={22} sw={on ? 2.1 : 1.85} />
            <div className="text-[10px]" style={{ fontWeight: on ? 700 : 500 }}>
              {t.label}
            </div>
          </button>
        )
      })}
    </LiquidGlassSurface>
  )
}

// ─── SettingsView ───────────────────────────────────────────────────────

const THEME_OPTIONS: { key: ThemeSetting; label: string }[] = [
  { key: 'system', label: '시스템 자동' },
  { key: 'light', label: '라이트' },
  { key: 'dark', label: '다크' },
]

const GLASS_OPTIONS: { key: GlassPerf; label: string }[] = [
  { key: 'full', label: '전체 (blur 28px)' },
  { key: 'low', label: '절약 (blur 10px)' },
  { key: 'none', label: '끄기 (불투명)' },
]

export function SettingsView({ onTabSelect, onLogout }: SettingsViewProps) {
  const { setting, glassPerf, setTheme } = useThemeContext()

  const handleGlassChange = useCallback((perf: GlassPerf) => {
    applyGlassPerf(perf)
    localStorage.setItem('glass-perf', perf)
  }, [])

  const currentGlass = (localStorage.getItem('glass-perf') as GlassPerf) ?? glassPerf

  const handleLogout = useCallback(() => {
    AuthManager.clearPat()
    onLogout()
  }, [onLogout])

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Radial wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(120% 60% at 50% 0%, var(--color-accent-soft), transparent 60%)',
        }}
      />

      {/* Scrollable content */}
      <div
        className="relative z-[1] flex-1 overflow-auto"
        style={{ paddingTop: 'calc(56px + var(--sai-top, 0px))', paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {/* Header */}
        <div className="px-5 pb-4 pt-3.5">
          <div
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            설정
          </div>
        </div>

        <div className="px-4">
          {/* Theme */}
          <Section title="테마">
            {THEME_OPTIONS.map((opt, i) => (
              <Row
                key={opt.key}
                label={opt.label}
                active={setting === opt.key}
                onTap={() => setTheme(opt.key)}
                last={i === THEME_OPTIONS.length - 1}
              />
            ))}
          </Section>

          {/* Glass performance */}
          <Section title="Liquid Glass 효과">
            {GLASS_OPTIONS.map((opt, i) => (
              <Row
                key={opt.key}
                label={opt.label}
                active={currentGlass === opt.key}
                onTap={() => handleGlassChange(opt.key)}
                last={i === GLASS_OPTIONS.length - 1}
              />
            ))}
          </Section>

          {/* Account */}
          <Section title="계정">
            <Row label="GitHub PAT" detail="••••••••" />
            <Row label="로그아웃" onTap={handleLogout} last danger />
          </Section>

          {/* App info */}
          <Section title="앱 정보">
            <Row label="버전" detail="v26.0" />
            <Row label="빌드" detail="PWA (Cloudflare Pages)" last />
          </Section>
        </div>
      </div>

      <TabBar active="settings" onSelect={onTabSelect} />
    </div>
  )
}
