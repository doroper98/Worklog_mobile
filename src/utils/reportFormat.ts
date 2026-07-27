/** Format a report date range as `YYYY.MM.DD–MM.DD` (or full when years differ). */
export function formatReportRange(dateFrom: string, dateTo: string): string {
  const [fy, fm, fd] = dateFrom.split('-')
  const [ty, tm, td] = dateTo.split('-')
  if (!fy || !ty) return `${dateFrom}–${dateTo}`
  if (fy === ty) return `${fy}.${fm}.${fd}–${tm}.${td}`
  return `${fy}.${fm}.${fd}–${ty}.${tm}.${td}`
}
