import { useState, useEffect, useCallback } from 'react'

import { CalendarService } from '@/services/CalendarService'
import type { DayFile, SlateEntry, FollowupItem } from '@/services/CalendarService'
import { formatDate } from '@/utils/calendarUtils'

interface UseTodayFilesResult {
  files: DayFile[]
  slates: SlateEntry[]
  followups: FollowupItem[]
  daysWithFiles: Set<number>
  selectedDate: string
  selectDate: (dateStr: string) => void
  loading: boolean
}

export function useTodayFiles(): UseTodayFilesResult {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [files, setFiles] = useState<DayFile[]>([])
  const [slates, setSlates] = useState<SlateEntry[]>([])
  const [followups, setFollowups] = useState<FollowupItem[]>([])
  const [daysWithFiles, setDaysWithFiles] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadDate = useCallback(async (dateStr: string) => {
    setLoading(true)
    try {
      const [y, m] = dateStr.split('-').map(Number)
      const day = parseInt(dateStr.split('-')[2], 10)

      const [data, daySlates, dayFollowups] = await Promise.all([
        CalendarService.getMonthData(y, m),
        CalendarService.getSlatesForDay(y, m, day),
        CalendarService.getPendingFollowupsForDate(dateStr),
      ])

      setDaysWithFiles(data.daysWithFiles)
      setFiles(data.filesByDay.get(day) ?? [])
      setSlates(daySlates)

      // Merge followups from config/followups.json + followup-type slates
      const slateFollowups: FollowupItem[] = daySlates
        .filter((s) => s.type === 'followup')
        .map((s) => ({
          id: s.id,
          description: s.title,
          sourceDate: dateStr,
          status: s.title.startsWith('[완료]') ? 'done' : 'pending',
          completed: s.title.startsWith('[완료]'),
          dueDate: null,
        }))
      // Config followups + slate followups (deduplicated by description is not needed, they're different sources)
      const pendingSlateFollowups = slateFollowups.filter((f) => !f.completed)
      setFollowups([...dayFollowups, ...pendingSlateFollowups])
    } catch {
      setFiles([])
      setSlates([])
      setFollowups([])
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

  return { files, slates, followups, daysWithFiles, selectedDate, selectDate, loading }
}
