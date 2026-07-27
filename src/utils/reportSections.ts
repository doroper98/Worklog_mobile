/**
 * Weekly-report content parser.
 *
 * Report `content` uses bracket headers to group projects, with each line
 * ending in `(MM/DD)` (completed) or `(~MM/DD)` (due / incomplete):
 *
 *   [프로젝트 A]
 *   - 항목 (04/09)
 *   - 항목 (~04/23)
 *
 *   [프로젝트 B]
 *   - 항목 (04/16)
 *
 * A plain markdown render flattens the bracket lines into paragraphs and loses
 * the hierarchy, so we pre-parse into collapsible sections. When the content
 * has no bracket header at all, `parseReportSections` returns null and the
 * caller falls back to a normal markdown render.
 */

export interface ReportItem {
  /** Item text with the trailing date token removed. */
  text: string
  /** MM/DD token, when present. */
  date?: string
  /** True when the date was written as `(~MM/DD)` — a due date / incomplete. */
  due: boolean
}

export interface ReportSection {
  title: string
  items: ReportItem[]
}

const BRACKET_HEADER_RE = /^\[(.+)\]\s*$/
const TRAILING_DATE_RE = /\((~?)(\d{1,2}\/\d{1,2})\)\s*$/

function parseItem(line: string): ReportItem {
  const text = line.replace(/^\s*[-*]\s+/, '').trim()
  const m = text.match(TRAILING_DATE_RE)
  if (!m) return { text, due: false }
  return {
    text: text.replace(TRAILING_DATE_RE, '').trim(),
    date: m[2],
    due: m[1] === '~',
  }
}

/**
 * Parse bracket-grouped report content into sections.
 * Returns null when the content contains no bracket header.
 */
export function parseReportSections(content: string): ReportSection[] | null {
  const lines = content.split('\n')
  if (!lines.some((l) => BRACKET_HEADER_RE.test(l.trim()))) return null

  const sections: ReportSection[] = []
  let current: ReportSection | null = null

  for (const raw of lines) {
    const line = raw.trim()
    const header = line.match(BRACKET_HEADER_RE)
    if (header) {
      current = { title: header[1].trim(), items: [] }
      sections.push(current)
      continue
    }
    if (!line) continue
    if (!current) {
      // Preamble before the first bracket header.
      current = { title: '', items: [] }
      sections.push(current)
    }
    current.items.push(parseItem(line))
  }

  return sections
}
