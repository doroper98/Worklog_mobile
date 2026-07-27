import { GitHubClient } from '@/services/GitHubClient'
import { useWikiTreeCache } from '@/hooks/useWikiTree'
import { CACHE_TTL } from '@/utils/constants'
import type { DirEntry, FileContent } from '@/types'

/** Decode base64 content from GitHub API as UTF-8 */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Strict weekly-report filename pattern.
 * The reports/ folder also holds unrelated artifacts (.pptx/.jpg/.md/.js),
 * so only files matching this exact shape are treated as reports (§1.3).
 *
 *   {YYYY-MM-DD}_{YYYY-MM-DD}_{timestamp}.json
 */
const REPORT_NAME_RE = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(\d+)\.json$/

/** Weekly note filename in wiki/notes (fallback source) */
const WIKI_NOTE_RE = /^weekly-(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})\.md$/

export interface WeeklyReport {
  id: string
  dateFrom: string // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
  createdAt: string // ISO
  content: string // markdown-ish plain text
  source: 'reports' | 'wiki-notes'
}

export interface ReportSummary {
  id: string
  dateFrom: string
  dateTo: string
  createdAt: string
  path: string
  source: 'reports' | 'wiki-notes'
  /** First meaningful line of content, when cheaply available. */
  preview?: string
}

interface ListCacheEntry {
  summaries: ReportSummary[]
  fetchedAt: number
}

let listCache: ListCacheEntry | null = null
const reportCache = new Map<string, WeeklyReport>()

/** Reconstruct createdAt (ISO) from the trailing epoch-ms timestamp in the id. */
function createdAtFromTimestamp(ts: string): string {
  const ms = Number(ts)
  if (!Number.isFinite(ms) || ms <= 0) return ''
  try {
    return new Date(ms).toISOString()
  } catch {
    return ''
  }
}

/** Sort newest first: primary by dateTo desc, tiebreak by createdAt desc. */
function byRecency(a: ReportSummary, b: ReportSummary): number {
  if (a.dateTo !== b.dateTo) return a.dateTo < b.dateTo ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}

/** Scan reports/ directory (1 API call) for weekly-report JSON files. */
async function scanReportsDir(): Promise<ReportSummary[]> {
  let entries: DirEntry[]
  try {
    const res = await GitHubClient.getContents('reports')
    entries = Array.isArray(res) ? res : []
  } catch (err) {
    // 404 → reports/ may not exist. Surface no banner, just an empty source.
    if (err instanceof Error && err.message.includes('404')) return []
    throw err
  }

  const out: ReportSummary[] = []
  for (const entry of entries) {
    if (entry.type !== 'file') continue
    const m = entry.name.match(REPORT_NAME_RE)
    if (!m) continue // silently drop non-report files (§1.3)
    const [, dateFrom, dateTo, ts] = m
    out.push({
      id: entry.name.replace(/\.json$/, ''),
      dateFrom,
      dateTo,
      createdAt: createdAtFromTimestamp(ts),
      path: entry.path,
      source: 'reports',
    })
  }
  return out
}

/**
 * Reuse the already-fetched recursive wiki tree (0 extra API calls) to find
 * wiki/notes/weekly-*.md as a fallback source for older reports.
 */
function scanWikiNotes(): ReportSummary[] {
  const tree = useWikiTreeCache.get()
  if (!tree) return []

  const out: ReportSummary[] = []
  for (const node of tree) {
    if (node.type !== 'blob') continue
    if (!node.path.startsWith('wiki/notes/')) continue
    const name = node.path.split('/').pop() ?? ''
    const m = name.match(WIKI_NOTE_RE)
    if (!m) continue
    const [, dateFrom, dateTo] = m
    out.push({
      id: `wiki-${dateFrom}_${dateTo}`,
      dateFrom,
      dateTo,
      createdAt: '', // wiki notes carry no createdAt
      path: node.path,
      source: 'wiki-notes',
    })
  }
  return out
}

/** Strip frontmatter/leading heading and return the first meaningful line. */
function firstMeaningfulLine(content: string): string {
  const lines = content.split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line === '---') continue
    if (/^#{1,6}\s/.test(line)) continue
    return line.replace(/^[-*]\s+/, '').slice(0, 80)
  }
  return ''
}

export const ReportsService = {
  /**
   * List reports newest-first. Merges the reports/ directory scan (primary)
   * with wiki/notes/weekly-*.md (fallback), deduped by date range.
   */
  async listReports(): Promise<ReportSummary[]> {
    if (listCache && Date.now() - listCache.fetchedAt < CACHE_TTL) {
      return listCache.summaries
    }

    const primary = await scanReportsDir()
    const fallback = scanWikiNotes()

    // Dedupe by dateFrom+dateTo; JSON source wins over wiki-notes.
    const byRange = new Map<string, ReportSummary>()
    for (const s of fallback) byRange.set(`${s.dateFrom}_${s.dateTo}`, s)
    for (const s of primary) byRange.set(`${s.dateFrom}_${s.dateTo}`, s)

    const summaries = [...byRange.values()].sort(byRecency)
    listCache = { summaries, fetchedAt: Date.now() }
    return summaries
  },

  /** Fetch and parse a single report's body (1 API call, cached). */
  async getReport(summary: ReportSummary): Promise<WeeklyReport> {
    const cached = reportCache.get(summary.path)
    if (cached) return cached

    const file = await GitHubClient.getContents(summary.path)
    if (Array.isArray(file)) throw new Error(`"${summary.path}" is a directory`)

    const decoded = await decodeContent(file)

    let report: WeeklyReport
    if (summary.source === 'reports') {
      const json = JSON.parse(decoded) as Record<string, unknown>
      report = {
        id: String(json.id ?? summary.id),
        dateFrom: String(json.dateFrom ?? summary.dateFrom),
        dateTo: String(json.dateTo ?? summary.dateTo),
        createdAt: String(json.createdAt ?? summary.createdAt),
        content: String(json.content ?? ''),
        source: 'reports',
      }
    } else {
      report = {
        id: summary.id,
        dateFrom: summary.dateFrom,
        dateTo: summary.dateTo,
        createdAt: summary.createdAt,
        content: decoded,
        source: 'wiki-notes',
      }
    }

    reportCache.set(summary.path, report)
    return report
  },

  /** Best-effort preview for a summary without a full parse round-trip. */
  previewOf(report: WeeklyReport): string {
    return firstMeaningfulLine(report.content)
  },

  clearCache(): void {
    listCache = null
    reportCache.clear()
  },
} as const

/** Decode a Contents-API file, falling back to the Blob API for >1 MB files. */
async function decodeContent(file: FileContent): Promise<string> {
  if (file.content) return decodeBase64Utf8(file.content)
  if (file.sha) return GitHubClient.getBlob(file.sha)
  throw new Error(`"${file.path}" has no readable content`)
}
