import { useState, useEffect, useCallback } from 'react'

import { CalendarService } from '@/services/CalendarService'
import type { DayFile } from '@/services/CalendarService'
import { formatDate } from '@/utils/calendarUtils'

interface UseTodayFilesResult {
  /** Files for the selected date */
  files: DayFile[]
  /** Set of day numbers with files for the current week's month */
  daysWithFiles: Set<number>
  /** Currently selected date string (YYYY-MM-DD) */
  selectedDate: string
  /** Select a different date */
  selectDate: (dateStr: string) => void
  /** Whether data is loading */
  loading: boolean
}

export function useTodayFiles(): UseTodayFilesResult {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [files, setFiles] = useState<DayFile[]>([])
  const [daysWithFiles, setDaysWithFiles] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadDate = useCallback(async (dateStr: string) => {
    setLoading(true)
    try {
      const [y, m] = dateStr.split('-').map(Number)
      const day = parseInt(dateStr.split('-')[2], 10)
      const data = await CalendarService.getMonthData(y, m)
      setDaysWithFiles(data.daysWithFiles)
      setFiles(data.filesByDay.get(day) ?? [])
    } catch {
      setFiles([])
      setDaysWithFiles(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDate(selectedDate)
  }, [selectedDate, loadDate])

  const selectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
  }, [])

  return { files, daysWithFiles, selectedDate, selectDate, loading }
}
