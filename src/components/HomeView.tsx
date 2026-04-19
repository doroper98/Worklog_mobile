import { useMemo } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { WikiCategory } from '@/hooks/useWikiTree'
import type { DayFile } from '@/services/CalendarService'
import type { RecentDoc } from '@/hooks/useRecentDocs'
import { OfflineBanner } from '@/components/OfflineBanner'
import {
  formatDate, getToday, DOW_LABELS,
} from '@/utils/calendarUtils'

// ─── Types ──────────────────────────────────────────────────────────────

interface HomeViewProps {
  categories: WikiCategory[]
  loading: boolean
  /** Today files */
  selectedDate: string
  todayFiles: DayFile[]
  todayLoading: boolean
  daysWithFiles: Set<number>
  onSelectDate: (dateStr: string) => void
  /** Recent docs */
  recentDocs: RecentDoc[]
  /** Offline */
  offline?: boolean
  /** Actions */
  onCategoryTap: (key: string) => void
  onFileTap: (path: string) => void
  onSearchTap: () => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const CATEGORY_META: Record<string, { icon: 'users' | 'folder' | 'alert' | 'file'; colorVar: string }> = {
  people:   { icon: 'users',  colorVar: '--color-personal' },
  projects: { icon: 'folder', colorVar: '--color-task' },
  issues:   { icon: 'alert',  colorVar: '--color-meet' },
  notes:    { icon: 'file',   colorVar: '--color-memo' },
}

const CATEGORY_COLOR_MAP: Record<string, string> = {
  people: '--color-personal',
  projects: '--color-task',
  issues: '--color-meet',
  notes: '--color-memo',
  markdown: '--color-daily',
  other: '--color-accent',
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
      <LiquidGlassSurface level={1} className="flex h-[42px] cursor-pointer items-center gap-2.5 overflow-hidden rounded-[14px] px-3.5">
        <button onClick={onTap} className="flex flex-1 items-center gap-2.5 border-none bg-transparent p-0 text-left" style={{ cursor: 'pointer' }}>
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

// ─── Week strip ────────────────────────────────────────────────────────

function WeekStrip({
  selectedDate,
  daysWithFiles,
  onSelectDate,
  onMonthTap,
}: {
  selectedDate: string
  daysWithFiles: Set<number>
  onSelectDate: (dateStr: string) => void
  onMonthTap: () => void
}) {
  const todayStr = getToday()

  // Build week days (Sunday-based)
  const weekDays = useMemo(() => {
    const sel = new Date(selectedDate.replace(/-/g, '/'))
    const start = new Date(sel)
    start.setDate(start.getDate() - start.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return formatDate(d)
    })
  }, [selectedDate])

  // Month label
  const selDate = new Date(selectedDate.replace(/-/g, '/'))
  const monthLabel = `${selDate.getFullYear()}년 ${selDate.getMonth() + 1}월`

  return (
    <div className="px-4 pb-1.5 pt-3">
      <LiquidGlassSurface level={1} className="overflow-hidden rounded-[18px] px-2 py-2.5">
        {/* Month header + Today button */}
        <div className="flex items-center justify-between px-2.5 pb-2">
          <button
            onClick={onMonthTap}
            className="inline-flex items-center gap-1 border-none bg-transparent p-0"
            style={{ cursor: 'pointer' }}
          >
            <span
              className="font-display text-sm font-bold tracking-tight"
              style={{ color: 'var(--color-text)' }}
            >
              {monthLabel}
            </span>
            <Icon name="chev-right" size={13} color="var(--color-text-muted)" sw={2.2} />
          </button>
          <button
            onClick={() => onSelectDate(todayStr)}
            disabled={selectedDate === todayStr}
            className="rounded-full border-none px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: selectedDate === todayStr ? 'transparent' : 'var(--color-accent)',
              color: selectedDate === todayStr ? 'var(--color-text-muted)' : 'var(--color-accent-text-on)',
              opacity: selectedDate === todayStr ? 0.5 : 1,
              cursor: selectedDate === todayStr ? 'default' : 'pointer',
            }}
          >
            Today
          </button>
        </div>

        {/* 7 day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {weekDays.map((dateStr, i) => {
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const dayNum = parseInt(dateStr.split('-')[2], 10)
            const isSun = i === 0
            const hasFile = daysWithFiles.has(dayNum)

            let bg = 'transparent'
            let txt = 'var(--color-text)'
            let labelColor = isSun ? 'var(--color-danger)' : 'var(--color-text-muted)'
            let dotBg = 'var(--color-accent)'

            if (isToday && !isSelected) {
              bg = 'var(--color-accent)'
              txt = 'var(--color-accent-text-on)'
              labelColor = 'rgba(255,255,255,0.8)'
              dotBg = 'rgba(255,255,255,0.85)'
            } else if (isSelected) {
              bg = 'var(--color-accent-soft)'
              txt = 'var(--color-accent)'
              labelColor = 'var(--color-accent)'
            } else if (isSun) {
              txt = 'var(--color-danger)'
            }

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className="flex flex-col items-center border-none bg-transparent py-1"
                style={{ cursor: 'pointer', borderRadius: 10 }}
              >
                <div
                  className="font-mono text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    color: labelColor,
                    marginBottom: 4,
                    opacity: isSelected || isToday ? 1 : 0.85,
                  }}
                >
                  {DOW_LABELS[i]}
                </div>
                <div
                  className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full"
                  style={{
                    background: bg,
                    fontSize: 15,
                    fontWeight: isToday || isSelected ? 700 : 500,
                    color: txt,
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'background 0.15s',
                  }}
                >
                  {dayNum}
                </div>
                <span
                  className="mt-0.5"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    background: hasFile ? dotBg : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </LiquidGlassSurface>
    </div>
  )
}

// ─── Today card ─────────────────────────────────────────────────────────

function TodayCard({
  files,
  loading,
  onFileTap,
}: {
  files: DayFile[]
  loading: boolean
  onFileTap: (path: string) => void
}) {
  if (loading) {
    return (
      <div
        className="mx-4 overflow-hidden rounded-[18px] border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3.5 py-2"
            style={{ borderBottom: i < 4 ? '1px solid var(--color-hairline)' : 'none' }}
          >
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-skel)' }} />
            <div className="h-2.5 w-8 rounded" style={{ background: 'var(--color-skel)' }} />
            <div className="h-3 flex-1 rounded" style={{ background: 'var(--color-skel)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div
        className="mx-4 rounded-[18px] border border-dashed p-[22px_18px]"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)' }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          아직 이 날의 파일이 없습니다
        </div>
        <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          하단 FAB으로 빠른 메모를 남기거나 데스크탑에서 생성할 수 있습니다.
        </div>
      </div>
    )
  }

  return (
    <div
      className="mx-4 overflow-hidden rounded-[18px] border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
    >
      {files.map((file, i) => (
        <button
          key={file.sha}
          onClick={() => onFileTap(file.path)}
          className="flex w-full items-center gap-2.5 border-none bg-transparent px-3.5 py-2 text-left"
          style={{
            borderBottom: i < files.length - 1 ? '1px solid var(--color-hairline)' : 'none',
            cursor: 'pointer',
            minHeight: 36,
          }}
        >
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: 'var(--color-accent)' }}
          />
          <div
            className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
            style={{ color: 'var(--color-text)', letterSpacing: '-0.015em' }}
          >
            {file.name.replace(/\.md$/, '')}
          </div>
          <span
            className="rounded px-1 py-0.5 font-mono text-[8.5px] font-bold tracking-wider"
            style={{ color: 'var(--color-daily)', background: 'color-mix(in srgb, var(--color-daily) 13%, transparent)' }}
          >
            MD
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Recent list ────────────────────────────────────────────────────────

function RecentList({
  docs,
  onFileTap,
}: {
  docs: RecentDoc[]
  onFileTap: (path: string) => void
}) {
  if (docs.length === 0) {
    return (
      <div
        className="mx-4 rounded-[18px] border p-5 text-center"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <div className="text-[13px] font-semibold" style={{ color: 'var(--color-text)' }}>
          아직 열어본 문서가 없습니다
        </div>
        <div className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          검색이나 Wiki에서 열면 여기에 최근 20개가 쌓입니다.
        </div>
      </div>
    )
  }

  // Relative time label
  const timeLabel = (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '방금'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    return `${days}d`
  }

  return (
    <div
      className="mx-4 overflow-hidden rounded-[18px] border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
    >
      {docs.map((doc, i) => {
        const colorVar = CATEGORY_COLOR_MAP[doc.category] ?? '--color-accent'
        return (
          <button
            key={doc.path}
            onClick={() => onFileTap(doc.path)}
            className="flex w-full items-center gap-2.5 border-none bg-transparent px-3.5 py-2 text-left"
            style={{
              borderBottom: i < docs.length - 1 ? '1px solid var(--color-hairline)' : 'none',
              cursor: 'pointer',
              minHeight: 36,
            }}
          >
            <span
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{ background: `var(${colorVar})` }}
            />
            <span
              className="w-14 flex-shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {doc.category}
            </span>
            <div
              className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
              style={{ color: 'var(--color-text)', letterSpacing: '-0.015em' }}
            >
              {doc.name}
            </div>
            <span
              className="flex-shrink-0 whitespace-nowrap font-mono text-[10px]"
              style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}
            >
              {timeLabel(doc.accessedAt)}
            </span>
          </button>
        )
      })}
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

// ─── FAB ────────────────────────────────────────────────────────────────

function FAB({ onTap }: { onTap?: () => void }) {
  return (
    <button
      onClick={onTap}
      className="absolute right-[22px] z-[45] flex h-14 w-14 items-center justify-center rounded-fab border-none"
      style={{
        bottom: 'calc(94px + var(--sai-bottom, 0px))',
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
  selectedDate,
  todayFiles,
  todayLoading,
  daysWithFiles,
  onSelectDate,
  recentDocs,
  offline = false,
  onCategoryTap,
  onFileTap,
  onSearchTap,
  onTabSelect,
  onFabTap,
}: HomeViewProps) {
  const totalDocs = categories.reduce((sum, c) => sum + c.count, 0)
  const todayStr = getToday()
  const isToday = selectedDate === todayStr

  // Section title for selected date
  const selDate = new Date(selectedDate.replace(/-/g, '/'))
  const dow = ['일', '월', '화', '수', '목', '금', '토'][selDate.getDay()]
  const sectionTitle = isToday
    ? `오늘 · ${String(selDate.getMonth() + 1).padStart(2, '0')}-${String(selDate.getDate()).padStart(2, '0')} ${dow}`
    : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 ${dow}`

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
        <AppBar />
        <SearchPill onTap={onSearchTap} count={totalDocs} />
        <OfflineBanner show={offline} />

        {/* Week strip */}
        <WeekStrip
          selectedDate={selectedDate}
          daysWithFiles={daysWithFiles}
          onSelectDate={onSelectDate}
          onMonthTap={() => onTabSelect('calendar')}
        />

        {/* Today / selected date section */}
        <div className="h-1.5" />
        <SectionHeader
          title={sectionTitle}
          detail={todayLoading ? '' : `${todayFiles.length} files`}
        />
        <TodayCard files={todayFiles} loading={todayLoading} onFileTap={onFileTap} />

        {/* Recent */}
        <div className="h-[22px]" />
        <SectionHeader title="최근 열어본 문서" detail={recentDocs.length > 0 ? `${recentDocs.length}` : undefined} />
        <RecentList docs={recentDocs} onFileTap={onFileTap} />

        {/* Wiki */}
        <div className="h-[22px]" />
        <SectionHeader title="Wiki" detail={`${categories.length} categories`} />
        <WikiGrid categories={categories} loading={loading} onTap={onCategoryTap} />

        <div className="h-8" />
      </div>

      <FAB onTap={onFabTap} />
      <TabBar active="home" onSelect={onTabSelect} />
    </div>
  )
}
