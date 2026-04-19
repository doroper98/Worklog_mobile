import { useState, useCallback, useMemo } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { useCalendarMonth } from '@/hooks/useCalendarMonth'
import type { DayFile } from '@/services/CalendarService'
import { buildMonthCells, getToday, DOW_LABELS, DOW_FULL, formatDate } from '@/utils/calendarUtils'

// ─── Types ──────────────────────────────────────────────────────────────

interface CalendarViewProps {
  onTabSelect: (tab: string) => void
  onFileTap: (path: string) => void
}

// ─── Tab bar (shared pattern with HomeView) ─────────────────────────────

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
  onSelectDate,
}: {
  year: number
  month: number
  selectedDate: string
  daysWithFiles: Set<number>
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
                {hasFile && (
                  <span
                    className="absolute"
                    style={{
                      bottom: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      background: dotColor,
                    }}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day list (bottom section) ──────────────────────────────────────────

function DayList({
  selectedDate,
  files,
  loading,
  onFileTap,
}: {
  selectedDate: string
  files: DayFile[]
  loading: boolean
  onFileTap: (path: string) => void
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
          {loading ? '...' : `${files.length} files`}
        </div>
      </div>

      {/* File list */}
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
        ) : files.length === 0 ? (
          <div
            className="mt-3 rounded-2xl border border-dashed p-[22px_18px] text-center"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border-strong)',
            }}
          >
            <div className="text-[13px] font-semibold" style={{ color: 'var(--color-text-sec)' }}>
              이 날 파일 없음
            </div>
            <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              데스크탑에서 작성된 일지가 여기에 표시됩니다.
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
            {files.map((file, i) => (
              <button
                key={file.sha}
                onClick={() => onFileTap(file.path)}
                className="flex w-full items-center gap-3 border-none bg-transparent px-4 py-3 text-left"
                style={{
                  borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <Icon name="file" size={16} color="var(--color-text-muted)" sw={1.8} />
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[13px] font-semibold"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {file.name.replace(/\.md$/, '')}
                  </div>
                </div>
                <Icon name="chev-right" size={14} color="var(--color-text-faint)" sw={2} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CalendarView ───────────────────────────────────────────────────────

export function CalendarView({ onTabSelect, onFileTap }: CalendarViewProps) {
  const {
    year, month,
    daysWithFiles, getFilesForDay,
    prevMonth, nextMonth, goToday,
    loading,
  } = useCalendarMonth()

  const todayStr = getToday()
  const [selectedDate, setSelectedDate] = useState(todayStr)

  // Check if viewing current month
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const handleSelectDate = useCallback((dateStr: string, isCurrent: boolean) => {
    if (!isCurrent) {
      // Navigate to that month
      const [y, m] = dateStr.split('-').map(Number)
      // The hook will handle month change, but we need to trigger it
      const targetDate = new Date(y, m - 1, 1)
      const currentView = new Date(year, month - 1, 1)
      if (targetDate < currentView) {
        prevMonth()
      } else {
        nextMonth()
      }
    }
    setSelectedDate(dateStr)
  }, [year, month, prevMonth, nextMonth])

  const handleToday = useCallback(() => {
    goToday()
    setSelectedDate(formatDate(new Date()))
  }, [goToday])

  // Get files for selected day
  const selectedDay = parseInt(selectedDate.split('-')[2], 10)
  const selectedMonth = parseInt(selectedDate.split('-')[1], 10)
  const selectedFiles = selectedMonth === month ? getFilesForDay(selectedDay) : []

  // If only 1 file for tapped date, go directly to it
  const handleFileTap = useCallback((path: string) => {
    onFileTap(path)
  }, [onFileTap])

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
        className="relative z-[1] flex min-h-0 flex-1 flex-col pb-24 pt-14"
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
          onSelectDate={handleSelectDate}
        />
        <DayList
          selectedDate={selectedDate}
          files={selectedFiles}
          loading={loading}
          onFileTap={handleFileTap}
        />
      </div>

      <FAB />
      <TabBar active="calendar" onSelect={onTabSelect} />
    </div>
  )
}
