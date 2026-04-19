import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { WikiCategory } from '@/hooks/useWikiTree'

// ─── Types ──────────────────────────────────────────────────────────────

interface HomeViewProps {
  categories: WikiCategory[]
  loading: boolean
  onCategoryTap: (key: string) => void
  onFileTap: (path: string) => void
  onSearchTap: () => void
  onTabSelect: (tab: string) => void
}

const CATEGORY_META: Record<string, { icon: 'users' | 'folder' | 'alert' | 'file'; colorVar: string }> = {
  people:   { icon: 'users',  colorVar: '--color-personal' },
  projects: { icon: 'folder', colorVar: '--color-task' },
  issues:   { icon: 'alert',  colorVar: '--color-meet' },
  notes:    { icon: 'file',   colorVar: '--color-memo' },
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

// ─── AppBar ─────────────────────────────────────────────────────────────

function AppBar() {
  return (
    <div className="flex items-center justify-between px-5 pb-2.5 pt-3.5">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px]"
          style={{ background: 'var(--color-accent)', boxShadow: '0 2px 10px var(--color-accent-faint)' }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <path d="M4.5 4.5h11.5l3.5 3.5v11.5H7.5L4.5 16.5v-12z"
              stroke="#fff" strokeWidth={1.9} strokeLinejoin="round" />
            <path d="M9 10l1.4 4.8L12 12l1.6 2.8L15 10"
              stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[19px] font-bold leading-tight tracking-tight"
            style={{ color: 'var(--color-text)' }}>
            Workwiki
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-widest"
            style={{ color: 'var(--color-text-muted)' }}>
            mobile · v26.0
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Search pill ────────────────────────────────────────────────────────

function SearchPill({ onTap, count }: { onTap: () => void; count: number }) {
  return (
    <div className="px-4 pb-1">
      <LiquidGlassSurface level={1} className="flex h-[42px] cursor-pointer items-center gap-2.5 overflow-hidden rounded-[14px] px-3.5"
        style={{ cursor: 'pointer' }}
      >
        <button onClick={onTap} className="flex flex-1 items-center gap-2.5 bg-transparent border-none cursor-pointer p-0 text-left">
          <Icon name="search" size={17} color="var(--color-text-muted)" sw={2} />
          <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-muted)' }}>
            위키·슬레이트·인물 검색
          </span>
          <span
            className="rounded-[5px] px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{
              background: 'var(--color-surface-alt)',
              color: 'var(--color-text-muted)',
            }}
          >
            {count}
          </span>
        </button>
      </LiquidGlassSurface>
    </div>
  )
}

// ─── Section header ─────────────────────────────────────────────────────

function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-[22px]">
      <div className="flex items-baseline gap-2">
        <div className="font-display text-[15px] font-bold tracking-tight"
          style={{ color: 'var(--color-text)' }}>
          {title}
        </div>
        {detail && (
          <div className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Wiki grid ──────────────────────────────────────────────────────────

function WikiGrid({ categories, loading, onTap }: {
  categories: WikiCategory[]
  loading: boolean
  onTap: (key: string) => void
}) {
  const items = categories.length > 0
    ? categories
    : (['people', 'projects', 'issues', 'notes'] as const).map((key) => ({
        key, title: key.charAt(0).toUpperCase() + key.slice(1), count: 0, files: [],
      }))

  return (
    <div className="mx-4 grid grid-cols-2 gap-2">
      {items.map((cat) => {
        const meta = CATEGORY_META[cat.key]
        return (
          <button
            key={cat.key}
            onClick={() => onTap(cat.key)}
            className="flex min-h-[80px] flex-col gap-2.5 rounded-2xl border p-3.5 text-left"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <div className="flex w-full items-center justify-between">
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px]"
                style={{
                  background: `color-mix(in srgb, var(${meta.colorVar}) 10%, transparent)`,
                  color: `var(${meta.colorVar})`,
                }}
              >
                <Icon name={meta.icon} size={16} />
              </div>
              <div className="font-mono text-[13px] font-bold tabular-nums tracking-tight"
                style={{ color: 'var(--color-text-sec)' }}>
                {loading ? '—' : cat.count}
              </div>
            </div>
            <div className="font-display text-[15px] font-bold tracking-tight"
              style={{ color: 'var(--color-text)' }}>
              {cat.title}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Tab bar ────────────────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  return (
    <LiquidGlassSurface
      level={2}
      className="absolute bottom-3.5 left-3.5 right-3.5 z-40 flex h-16 items-center justify-around overflow-hidden rounded-tab px-1.5"
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

// ─── FAB ────────────────────────────────────────────────────────────────

function FAB({ onTap }: { onTap?: () => void }) {
  return (
    <button
      onClick={onTap}
      className="absolute bottom-[94px] right-[22px] z-[45] flex h-14 w-14 items-center justify-center rounded-fab border-none"
      style={{
        background: 'var(--color-accent)',
        color: 'var(--color-accent-text-on)',
        boxShadow: '0 10px 28px var(--color-accent-faint), 0 2px 8px rgba(0,0,0,0.18)',
      }}
    >
      <Icon name="pen" size={22} color="var(--color-accent-text-on)" sw={2.1} />
    </button>
  )
}

// ─── HomeView ───────────────────────────────────────────────────────────

export function HomeView({
  categories,
  loading,
  onCategoryTap,
  onFileTap: _onFileTap,
  onSearchTap,
  onTabSelect,
}: HomeViewProps) {
  const totalDocs = categories.reduce((sum, c) => sum + c.count, 0)

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
      <div className="relative z-[1] flex-1 overflow-auto pb-24 pt-14">
        <AppBar />
        <SearchPill onTap={onSearchTap} count={totalDocs} />

        <div className="h-3" />
        <SectionHeader title="Wiki" detail={`${categories.length} categories`} />
        <WikiGrid categories={categories} loading={loading} onTap={onCategoryTap} />

        <div className="h-8" />
      </div>

      <FAB />
      <TabBar active="home" onSelect={onTabSelect} />
    </div>
  )
}
