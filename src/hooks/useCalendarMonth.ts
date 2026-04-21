import { useState, useEffect, useCallback } from 'react'

import { CalendarService } from '@/services/CalendarService'
import type { DayFile, SlateEntry, MonthData } from '@/services/CalendarService'

interface UseCalendarMonthResult {
  /** Current view year */
  year: number
  /** Current view month (1-12) */
  month: number
  /** Set of day numbers that have files */
  daysWithFiles: Set<number>
  /** Set of date strings (YYYY-MM-DD) that have pending followups */
  followupDates: Set<string>
  /** Get files for a specific day */
  getFilesForDay: (day: number) => DayFile[]
  /** Get parsed slates for a specific day */
  getSlatesForDay: (day: number) => Promise<SlateEntry[]>
  /** Navigate to previous month */
  prevMonth: () => void
  /** Navigate to next month */
  nextMonth: () => void
  /** Jump to today's month */
  goToday: () => void
  /** Whether month data is loading */
  loading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Re-fetch current month */
  refresh: () => void
}

export function useCalendarMonth(): UseCalendarMonthResult {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-based
  const [monthData, setMonthData] = useState<MonthData | null>(null)
  const [followupDates, setFollowupDates] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      CalendarService.getMonthData(year, month),
      CalendarService.getFollowupDates(),
    ])
      .then(([data, fuDates]) => {
        if (!cancelled) {
          setMonthData(data)
          setFollowupDates(fuDates)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '달력 데이터를 불러올 수 없습니다.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [year, month, refreshNonce])

  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1)
  }, [])

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }, [month])

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }, [month])

  const goToday = useCallback(() => {
    const today = new Date()
    setYear(today.getFullYear())
    setMonth(today.getMonth() + 1)
  }, [])

  const getFilesForDay = useCallback(
    (day: number): DayFile[] => {
      return monthData?.filesByDay.get(day) ?? []
    },
    [monthData],
  )

  const getSlatesForDay = useCallback(
    async (day: number): Promise<SlateEntry[]> => {
      return CalendarService.getSlatesForDay(year, month, day)
    },
    [year, month],
  )

  return {
    year,
    month,
    daysWithFiles: monthData?.daysWithFiles ?? new Set(),
    followupDates,
    getFilesForDay,
    getSlatesForDay,
    prevMonth,
    nextMonth,
    goToday,
    loading,
    error,
    refresh,
  }
}
