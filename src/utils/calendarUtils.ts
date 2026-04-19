/** Date utilities for calendar — adapted from CalendarData.jsx handoff bundle */

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getToday(): string {
  return formatDate(new Date())
}

export function dayOfWeek(str: string): number {
  return parseDate(str).getDay()
}

interface RawCell {
  day: number
  month: number
  year: number
  current: boolean
}

export interface MonthCell extends RawCell {
  dateStr: string
}

/** Build 6×7 = 42 cells for a given year and month index (0-based) */
export function buildMonthCells(year: number, monthIdx: number): MonthCell[] {
  const firstDay = new Date(year, monthIdx, 1).getDay()
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const daysInPrev = new Date(year, monthIdx, 0).getDate()
  const cells: RawCell[] = []

  // Previous month fill
  for (let i = firstDay - 1; i >= 0; i--) {
    const pm = monthIdx === 0 ? 11 : monthIdx - 1
    const py = monthIdx === 0 ? year - 1 : year
    cells.push({ day: daysInPrev - i, month: pm, year: py, current: false })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: monthIdx, year, current: true })
  }

  // Next month fill
  const nm = monthIdx === 11 ? 0 : monthIdx + 1
  const ny = monthIdx === 11 ? year + 1 : year
  let n = 1
  while (cells.length < 42) {
    cells.push({ day: n++, month: nm, year: ny, current: false })
  }

  return cells.map((c) => ({
    ...c,
    dateStr: `${c.year}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
  }))
}

/** Korean day-of-week labels (Sunday first) */
export const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** Full day-of-week labels */
export const DOW_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const
