import { useState, useEffect, useCallback } from 'react'

import { ReportsService } from '@/services/ReportsService'
import type { ReportSummary } from '@/services/ReportsService'

interface UseReportsResult {
  reports: ReportSummary[]
  loading: boolean
  error: string | null
  refresh: () => void
}

/** Loads the weekly-report list (newest first). */
export function useReports(): UseReportsResult {
  const [reports, setReports] = useState<ReportSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await ReportsService.listReports()
      setReports(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : '주간보고 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { reports, loading, error, refresh: load }
}
