import { useState, useCallback, useMemo, useEffect } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { useCalendarMonth } from '@/hooks/useCalendarMonth'
import type { SlateEntry } from '@/services/CalendarService'
import { buildMonthCells, getToday, DOW_LABELS, DOW_FULL, formatDate } from '@/utils/calendarUtils'

// ─── Types ──────────────────────────────────────────────────────────────

interface CalendarViewProps {
  onTabSelect: (tab: string) => void
  onSlateTap: (slate: SlateEntry) => void
  onFabTap?: () => void
}

// Slate type → icon/color mapping
const SLATE_TYPE_META: Record<string, { icon: 'users' | 'folder' | 'file' | 'alert'; colorVar: string; label: string }> = {
  meeting:  { icon: 'users',  colorVar: '--color-meet',     label: '회의' },
  task:     { icon: 'folder', colorVar: '--color-task',     label: '업무' },
  memo:     { icon: 'file',   colorVar: '--color-memo',     label: '메모' },
  personal: { icon: 'alert', colorVar: '--color-personal', label: '개인' },
}

// ─── Tab bar ────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

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

// ─── Header ─────────────────────────────────────────────────────────────

function CalendarHeader({
  year,
  month,
  isCurrentMonth,
  onPrev,
  onNext,
  onToday,
}: {
  year: number
  month: number
  isCurrentMonth: boolean
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="flex items-center justify-between px-5 pb-2.5 pt-3.5">
      <div
        className="font-display text-2xl font-bold tracking-tight"
        style={{ color: 'var(--color-text)', letterSpacing: '-0.025em' }}
      >
        {year}년 {month}월
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToday}
          disabled={isCurrentMonth}
          className="rounded-full border-none px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: isCurrentMonth ? 'var(--color-surface-alt)' : 'var(--color-accent)',
            color: isCurrentMonth ? 'var(--color-text-muted)' : 'var(--color-accent-text-on)',
            opacity: isCurrentMonth ? 0.5 : 1,
            cursor: isCurrentMonth ? 'default' : 'pointer',
            marginRight: 4,
          }}
        >
          Today
        </button>
        <button
          onClick={onPrev}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Icon name="chev-left" size={15} color="var(--color-text-sec)" sw={2.2} />
        </button>
        <button
          onClick={onNext}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <Icon name="chev-right" size={15} color="var(--color-text-sec)" sw={2.2} />
        </button>
      </div>
    </div>
  )
}

// ─── Grid ───────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  selectedDate,
  daysWithFiles,
  followupDates,
  onSelectDate,
}: {
  year: number
  month: number
  selectedDate: string
  daysWithFiles: Set<number>
  followupDates: Set<string>
  onSelectDate: (dateStr: string, isCurrent: boolean) => void
}) {
  const cells = useMemo(() => buildMonthCells(year, month - 1), [year, month])
  const todayStr = getToday()

  return (
    <div className="px-3 pb-3">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 py-1.5">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className="text-center font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ color: i === 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7" style={{ rowGap: 2 }}>
        {cells.map((cell, i) => {
          const isToday = cell.dateStr === todayStr
          const isSelected = cell.dateStr === selectedDate
          const isSun = new Date(cell.year, cell.month, cell.day).getDay() === 0
          const hasFile = cell.current && daysWithFiles.has(cell.day)
          const hasFollowup = cell.current && followupDates.has(cell.dateStr)

          let bg = 'transparent'
          let textColor = cell.current
            ? (isSun && !isToday && !isSelected ? 'var(--color-danger)' : 'var(--color-text)')
            : 'var(--color-text-faint)'
          let dotColor = 'var(--color-accent)'

          if (isToday && !isSelected) {
            bg = 'var(--color-accent)'
            textColor = 'var(--color-accent-text-on)'
            dotColor = 'rgba(255,255,255,0.85)'
          } else if (isSelected) {
            bg = 'var(--color-accent-soft)'
            textColor = 'var(--color-accent)'
            dotColor = 'var(--color-accent)'
          }

          return (
            <button
              key={i}
              onClick={() => onSelectDate(cell.dateStr, cell.current)}
              className="flex h-12 items-center justify-center border-none bg-transparent p-0.5"
              style={{ cursor: 'pointer' }}
            >
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full"
                style={{
                  background: bg,
                  fontSize: 14.5,
                  fontWeight: isToday || isSelected ? 700 : 500,
                  color: textColor,
                  opacity: cell.current ? 1 : 0.4,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'background 0.15s',
                }}
              >
                {cell.day}
                {/* Dots row: journal (accent) + followup (red) */}
                <span
                  className="absolute flex items-center gap-[3px]"
                  style={{ bottom: 1, left: '50%', transform: 'translateX(-50%)' }}
                >
                  {hasFile && (
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        background: dotColor,
                      }}
                    />
                  )}
                  {hasFollowup && (
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--color-danger)',
                      }}
                    />
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Slate list (bottom section) ────────────────────────────────────────

function SlateList({
  selectedDate,
  slates,
  loading,
  onSlateTap,
}: {
  selectedDate: string
  slates: SlateEntry[]
  loading: boolean
  onSlateTap: (slate: SlateEntry) => void
}) {
  const [y, m, d] = selectedDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dowLabel = DOW_FULL[date.getDay()]
  const todayStr = getToday()
  const isToday = selectedDate === todayStr

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ background: 'var(--color-bg2)', borderTop: '1px solid var(--color-border)' }}
    >
      {/* Day header */}
      <div className="flex items-baseline justify-between px-[22px] pb-2.5 pt-3.5">
        <div className="flex items-baseline gap-2">
          <div
            className="font-display text-[17px] font-bold tracking-tight"
            style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}
          >
            {m}월 {d}일
          </div>
          <div className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {dowLabel}{isToday ? ' · 오늘' : ''}
          </div>
        </div>
        <div
          className="font-mono text-[11px]"
          style={{ color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}
        >
          {loading ? '...' : `${slates.length} slates`}
        </div>
      </div>

      {/* Slate list */}
      <div className="flex-1 overflow-auto px-4 pb-6">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl"
                style={{ background: 'var(--color-skel)', width: `${90 - i * 15}%` }}
              />
            ))}
          </div>
        ) : slates.length === 0 ? (
          <div
            className="mt-3 rounded-2xl border border-dashed p-[22px_18px] text-center"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border-strong)',
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: 'var(--color-text-sec)' }}>
              이 날 슬레이트 없음
            </div>
            <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              데스크탑에서 작성된 슬레이트가 여기에 표시됩니다.
            </div>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            {slates.map((slate, i) => {
              const meta = SLATE_TYPE_META[slate.type] ?? SLATE_TYPE_META.memo
              return (
                <button
                  key={slate.id}
                  onClick={() => onSlateTap(slate)}
                  className="flex w-full items-center gap-3 border-none bg-transparent px-4 py-3 text-left"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, var(${meta.colorVar}) 12%, transparent)`,
                    }}
                  >
                    <Icon name={meta.icon} size={14} color={`var(${meta.colorVar})`} sw={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[13px] font-semibold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {slate.title}
                    </div>
                    <div
                      className="mt-0.5 text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {meta.label}
                    </div>
                  </div>
                  <Icon name="chev-right" size={14} color="var(--color-text-faint)" sw={2} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CalendarView ───────────────────────────────────────────────────────

export function CalendarView({ onTabSelect, onSlateTap, onFabTap }: CalendarViewProps) {
  const {
    year, month,
    daysWithFiles, followupDates,
    getSlatesForDay,
    prevMonth, nextMonth, goToday,
    loading,
  } = useCalendarMonth()

  const todayStr = getToday()
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [slates, setSlates] = useState<SlateEntry[]>([])
  const [slateLoading, setSlateLoading] = useState(false)

  // Check if viewing current month
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  // Fetch slates when selected date changes
  const selectedDay = parseInt(selectedDate.split('-')[2], 10)
  const selectedMonth = parseInt(selectedDate.split('-')[1], 10)

  useEffect(() => {
    if (loading || selectedMonth !== month) {
      return
    }

    let cancelled = false
    setSlateLoading(true)

    getSlatesForDay(selectedDay)
      .then((result) => {
        if (!cancelled) setSlates(result)
      })
      .catch(() => {
        if (!cancelled) setSlates([])
      })
      .finally(() => {
        if (!cancelled) setSlateLoading(false)
      })

    return () => { cancelled = true }
  }, [selectedDay, selectedMonth, month, loading, getSlatesForDay])

  const handleSelectDate = useCallback((dateStr: string, isCurrent: boolean) => {
    if (!isCurrent) {
      const [, m] = dateStr.split('-').map(Number)
      const targetMonth = m
      if (targetMonth < month || (targetMonth === 12 && month === 1)) {
        prevMonth()
      } else {
        nextMonth()
      }
    }
    setSelectedDate(dateStr)
  }, [month, prevMonth, nextMonth])

  const handleToday = useCallback(() => {
    goToday()
    setSelectedDate(formatDate(new Date()))
  }, [goToday])

  const handleSlateTap = useCallback((slate: SlateEntry) => {
    onSlateTap(slate)
  }, [onSlateTap])

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Radial wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(120% 50% at 50% 0%, var(--color-accent-soft), transparent 60%)',
        }}
      />

      {/* Content */}
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col"
        style={{ paddingTop: 'calc(56px + var(--sai-top, 0px))', paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        <CalendarHeader
          year={year}
          month={month}
          isCurrentMonth={isCurrentMonth}
          onPrev={prevMonth}
          onNext={nextMonth}
          onToday={handleToday}
        />
        <CalendarGrid
          year={year}
          month={month}
          selectedDate={selectedDate}
          daysWithFiles={daysWithFiles}
          followupDates={followupDates}
          onSelectDate={handleSelectDate}
        />
        <SlateList
          selectedDate={selectedDate}
          slates={slates}
          loading={loading || slateLoading}
          onSlateTap={handleSlateTap}
        />
      </div>

      <FAB onTap={onFabTap} />
      <TabBar active="calendar" onSelect={onTabSelect} />
    </div>
  )
}
