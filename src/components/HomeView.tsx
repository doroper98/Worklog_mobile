import { useState, useMemo, useCallback, useRef } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { WikiCategory } from '@/hooks/useWikiTree'
import type { SlateEntry, FollowupItem } from '@/services/CalendarService'
import { OfflineBanner } from '@/components/OfflineBanner'
import {
  formatDate, getToday, DOW_LABELS,
} from '@/utils/calendarUtils'

// ─── Types ──────────────────────────────────────────────────────────────

interface HomeViewProps {
  categories: WikiCategory[]
  loading: boolean
  /** Today slates */
  selectedDate: string
  todaySlates: SlateEntry[]
  todayFollowups: FollowupItem[]
  todayLoading: boolean
  daysWithFiles: Set<number>
  /** Set of YYYY-MM-DD strings with pending followups */
  followupDates?: Set<string>
  onSelectDate: (dateStr: string) => void
  /** Offline */
  offline?: boolean
  /** Meta-index: ingested slate IDs */
  ingestedIds?: Set<string>
  /** Actions */
  onCategoryTap: (key: string) => void
  onSlateTap: (slate: SlateEntry) => void
  onMdTap?: (slate: SlateEntry) => void
  onSearchTap: () => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const SLATE_TYPE_META: Record<string, { icon: 'users' | 'folder' | 'file' | 'alert' | 'calendar'; colorVar: string; label: string }> = {
  meeting:  { icon: 'users',    colorVar: '--color-meet',     label: '회의' },
  task:     { icon: 'folder',   colorVar: '--color-task',     label: '업무' },
  memo:     { icon: 'file',     colorVar: '--color-memo',     label: '메모' },
  personal: { icon: 'alert',    colorVar: '--color-personal', label: '개인' },
  daily:    { icon: 'calendar', colorVar: '--color-task',     label: 'Daily MD' },
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
            mobile · v{__APP_VERSION__}
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

/** Get the Sunday of the week containing the given date */
function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr.replace(/-/g, '/'))
  d.setDate(d.getDate() - d.getDay())
  return d
}

function WeekStrip({
  selectedDate,
  daysWithFiles,
  followupDates,
  onSelectDate,
}: {
  selectedDate: string
  daysWithFiles: Set<number>
  followupDates?: Set<string>
  onSelectDate: (dateStr: string) => void
}) {
  const todayStr = getToday()
  const containerRef = useRef<HTMLDivElement>(null)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [animating, setAnimating] = useState(false)

  // Build week days (Sunday-based)
  const weekDays = useMemo(() => {
    const start = getWeekStart(selectedDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return formatDate(d)
    })
  }, [selectedDate])

  // Month label
  const selDate = new Date(selectedDate.replace(/-/g, '/'))
  const monthLabel = `${selDate.getFullYear()}년 ${selDate.getMonth() + 1}월`

  const navigateWeek = useCallback((dir: 'left' | 'right') => {
    if (animating) return
    setSlideDir(dir)
    setAnimating(true)

    setTimeout(() => {
      const offset = dir === 'left' ? -7 : 7
      const current = new Date(selectedDate.replace(/-/g, '/'))
      current.setDate(current.getDate() + offset)
      onSelectDate(formatDate(current))

      // Reset animation after state update
      requestAnimationFrame(() => {
        setSlideDir(null)
        setAnimating(false)
      })
    }, 200)
  }, [selectedDate, onSelectDate, animating])

  // Slide transform
  const slideTransform = slideDir === 'left'
    ? 'translateX(-30px)'
    : slideDir === 'right'
      ? 'translateX(30px)'
      : 'translateX(0)'

  return (
    <div className="px-4 pb-1.5 pt-3">
      <LiquidGlassSurface level={1} className="overflow-hidden rounded-[18px] px-2 py-2.5">
        {/* Month label + Today button */}
        <div className="flex items-center justify-between px-2.5 pb-2">
          <span
            className="font-display text-sm font-bold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            {monthLabel}
          </span>
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

        {/* Week navigation row */}
        <div className="flex items-center">
          {/* Prev week arrow */}
          <button
            onClick={() => navigateWeek('left')}
            className="flex h-10 w-7 flex-shrink-0 items-center justify-center border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            <Icon name="chev-left" size={14} sw={2.2} />
          </button>

          {/* 7 day cells with slide animation */}
          <div
            ref={containerRef}
            className="grid flex-1 grid-cols-7 gap-0.5"
            style={{
              transform: slideTransform,
              opacity: slideDir ? 0.3 : 1,
              transition: slideDir
                ? 'transform 0.2s ease-out, opacity 0.15s ease-out'
                : 'transform 0.15s ease-out, opacity 0.15s ease-in',
            }}
          >
            {weekDays.map((dateStr, i) => {
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dayNum = parseInt(dateStr.split('-')[2], 10)
              const isSun = i === 0
              const hasFile = daysWithFiles.has(dayNum)

              const hasFollowup = followupDates?.has(dateStr) ?? false

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
                    {hasFollowup && (
                      <span
                        className="absolute"
                        style={{
                          top: 2,
                          right: 2,
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: '#ff3b30',
                        }}
                      />
                    )}
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

          {/* Next week arrow */}
          <button
            onClick={() => navigateWeek('right')}
            className="flex h-10 w-7 flex-shrink-0 items-center justify-center border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
          >
            <Icon name="chev-right" size={14} sw={2.2} />
          </button>
        </div>
      </LiquidGlassSurface>
    </div>
  )
}

// ─── Today card ─────────────────────────────────────────────────────────

function TodayCard({
  slates,
  loading,
  ingestedIds,
  onSlateTap,
  onMdTap,
}: {
  slates: SlateEntry[]
  loading: boolean
  ingestedIds?: Set<string>
  onSlateTap: (slate: SlateEntry) => void
  onMdTap?: (slate: SlateEntry) => void
}) {
  if (loading) {
    return (
      <div
        className="mx-4 overflow-hidden rounded-[18px] border"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 px-3.5 py-2.5"
            style={{ borderBottom: i < 2 ? '1px solid var(--color-hairline)' : 'none' }}
          >
            <div className="h-7 w-7 rounded-lg" style={{ background: 'var(--color-skel)' }} />
            <div className="h-3.5 flex-1 rounded" style={{ background: 'var(--color-skel)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (slates.length === 0) {
    return (
      <div
        className="mx-4 rounded-[18px] border border-dashed p-[22px_18px]"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)' }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          아직 이 날의 슬레이트가 없습니다
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
      {slates.map((slate, i) => {
        const isDaily = slate.type === 'daily'
        const meta = SLATE_TYPE_META[slate.type] ?? SLATE_TYPE_META.memo
        const hasMd = Boolean(slate.markdown) || (ingestedIds?.has(slate.id) ?? false)
        // Extract time from createdAt (HH:MM)
        let timeStr = ''
        if (!isDaily) {
          try {
            const d = new Date(slate.createdAt)
            if (!isNaN(d.getTime())) {
              timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            }
          } catch { /* ignore */ }
        }

        return (
          <div
            key={slate.id}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5"
            style={{
              borderBottom: i < slates.length - 1 ? '1px solid var(--color-hairline)' : 'none',
              minHeight: 40,
              background: isDaily ? 'color-mix(in srgb, #4caf50 5%, transparent)' : undefined,
            }}
          >
            {/* Color dot + time (or DAILY label) */}
            <div className="flex flex-shrink-0 flex-col items-center gap-0.5" style={{ width: 40 }}>
              {isDaily ? (
                <span
                  className="rounded px-1 py-0.5 font-mono text-[8px] font-bold uppercase"
                  style={{ background: 'color-mix(in srgb, #4caf50 15%, transparent)', color: '#4caf50' }}
                >
                  Daily
                </span>
              ) : (
                <>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `var(${meta.colorVar})` }}
                  />
                  {timeStr && (
                    <span className="font-mono text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                      {timeStr}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Title — daily taps go to MD view, regular slates go to slate view */}
            <button
              onClick={() => isDaily && onMdTap ? onMdTap(slate) : onSlateTap(slate)}
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-left"
              style={{ cursor: 'pointer' }}
            >
              <div
                className="truncate text-[13.5px] font-medium"
                style={{ color: 'var(--color-text)', letterSpacing: '-0.015em' }}
              >
                {slate.title}
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {meta.label}
              </div>
            </button>

            {/* MD badge — green for daily, accent for others */}
            {hasMd && onMdTap && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMdTap(slate)
                }}
                className="flex-shrink-0 rounded-md border-none px-2 py-1 font-mono text-[11px] font-bold"
                style={{
                  background: isDaily
                    ? 'color-mix(in srgb, #4caf50 15%, transparent)'
                    : 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                  color: isDaily ? '#4caf50' : 'var(--color-accent)',
                  cursor: 'pointer',
                }}
              >
                MD
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Followup list ──────────────────────────────────────────────────────

function FollowupList({ items }: { items: FollowupItem[] }) {
  if (items.length === 0) return null

  return (
    <div
      className="mx-4 overflow-hidden rounded-[18px] border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className="flex items-start gap-2.5 px-3.5 py-2.5"
          style={{
            borderBottom: i < items.length - 1 ? '1px solid var(--color-hairline)' : 'none',
            minHeight: 40,
          }}
        >
          <span
            className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: 'var(--color-danger)' }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="text-[13px] font-medium leading-snug"
              style={{ color: 'var(--color-text)' }}
            >
              {item.description}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {item.sourceDate}
              </span>
              {item.dueDate && (
                <span className="font-mono text-[10px]" style={{ color: 'var(--color-danger)' }}>
                  ~{item.dueDate}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
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
  todaySlates,
  todayFollowups,
  todayLoading,
  daysWithFiles,
  onSelectDate,
  offline = false,
  followupDates,
  ingestedIds,
  onCategoryTap,
  onSlateTap,
  onMdTap,
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

      {/* Fixed top area: AppBar + Search + WeekStrip */}
      <div
        className="relative z-10 flex-shrink-0"
        style={{ paddingTop: 'calc(16px + var(--sai-top, 0px))' }}
      >
        <AppBar />
        <SearchPill onTap={onSearchTap} count={totalDocs} />
        <OfflineBanner show={offline} />
        <WeekStrip
          selectedDate={selectedDate}
          daysWithFiles={daysWithFiles}
          followupDates={followupDates}
          onSelectDate={onSelectDate}
        />
      </div>

      {/* Scrollable content: slates, followups, wiki */}
      <div
        className="relative z-[1] flex-1 overflow-auto"
        style={{ paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {/* Today / selected date section */}
        <div className="h-1.5" />
        <SectionHeader
          title={sectionTitle}
          detail={todayLoading ? '' : `${todaySlates.length} slates`}
        />
        <TodayCard slates={todaySlates} loading={todayLoading} ingestedIds={ingestedIds} onSlateTap={onSlateTap} onMdTap={onMdTap} />

        {/* Follow up */}
        {todayFollowups.length > 0 && (
          <>
            <div className="h-[22px]" />
            <SectionHeader title="Follow up" detail={`${todayFollowups.length}`} />
            <FollowupList items={todayFollowups} />
          </>
        )}

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
