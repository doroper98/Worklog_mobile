import MiniSearch from 'minisearch'

import { GitHubClient } from '@/services/GitHubClient'
import { CalendarService } from '@/services/CalendarService'
import type { SlateEntry } from '@/services/CalendarService'
import { formatDate } from '@/utils/calendarUtils'
import type { TreeNode } from '@/types'

export interface SearchDocument {
  id: string
  path: string
  name: string
  category: string
  content: string
  /** Journal date (YYYY-MM-DD) — slate documents only */
  date?: string
  /** Slate id within the journal — slate documents only */
  slateId?: string
}

export interface SearchResult {
  path: string
  name: string
  category: string
  /** Matched terms for highlighting */
  terms: string[]
  score: number
  /** Journal date — present on slate results */
  date?: string
  /** Slate id — present on slate results */
  slateId?: string
}

export interface EnrichmentProgress {
  done: number
  total: number
}

/** How many days of journals to index for slate search */
const SLATE_INDEX_DAYS = 30

/** Cap per-document indexed text to bound memory on huge slates */
const SLATE_CONTENT_CAP = 20_000

let index: MiniSearch<SearchDocument> | null = null
let building = false
let buildPromise: Promise<void> | null = null

let enriching = false
let enrichmentDone = 0
let enrichmentTotal = 0
let enrichmentToken = 0

let slateIndexing = false
let slateDone = 0
let slateTotal = 0

/** docId → full slate entry, so search results can open the SlateView */
const slateEntries = new Map<string, SlateEntry>()

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ['name', 'path', 'content'],
    storeFields: ['path', 'name', 'category', 'date', 'slateId'],
    searchOptions: {
      boost: { name: 3, path: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
}

/**
 * Index the last SLATE_INDEX_DAYS days of journal slates.
 * Month listings tell us which days actually have files, so we only fetch
 * real journals (reusing CalendarService caches shared with home/calendar).
 */
async function indexRecentSlates(
  idx: MiniSearch<SearchDocument>,
  myToken: number,
): Promise<void> {
  slateIndexing = true
  slateDone = 0
  slateTotal = 0

  try {
    // Collect candidate dates (newest first) across the 1-2 months in range.
    const today = new Date()
    const dates: { y: number; m: number; d: number; str: string }[] = []
    const monthData = new Map<string, Set<number>>()

    for (let i = 0; i < SLATE_INDEX_DAYS; i++) {
      const dt = new Date(today)
      dt.setDate(dt.getDate() - i)
      const y = dt.getFullYear()
      const m = dt.getMonth() + 1
      const key = `${y}-${m}`
      if (!monthData.has(key)) {
        if (enrichmentToken !== myToken) return
        const data = await CalendarService.getMonthData(y, m)
        monthData.set(key, data.daysWithFiles)
      }
      const d = dt.getDate()
      if (monthData.get(key)?.has(d)) {
        dates.push({ y, m, d, str: formatDate(dt) })
      }
    }

    slateTotal = dates.length

    // Journals can be multi-MB; keep concurrency low.
    const CONCURRENCY = 2
    let cursor = 0

    async function worker(): Promise<void> {
      while (cursor < dates.length) {
        if (enrichmentToken !== myToken) return
        const { y, m, d, str } = dates[cursor++]
        try {
          const slates = await CalendarService.getSlatesForDay(y, m, d)
          if (enrichmentToken !== myToken) return
          for (const slate of slates) {
            const docId = `slate:${str}:${slate.id}`
            if (idx.has(docId)) continue
            const text = `${slate.content}\n${slate.markdown}`.slice(0, SLATE_CONTENT_CAP)
            idx.add({
              id: docId,
              path: docId,
              name: slate.title || '(제목 없음)',
              category: 'slate',
              content: text,
              date: str,
              slateId: slate.id,
            })
            slateEntries.set(docId, slate)
          }
        } catch {
          // skip this day — indexing is best-effort
        } finally {
          slateDone++
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  } finally {
    if (enrichmentToken === myToken) {
      slateIndexing = false
    }
  }
}

async function enrichWithContent(
  files: TreeNode[],
  idx: MiniSearch<SearchDocument>,
  myToken: number,
): Promise<void> {
  enriching = true
  enrichmentDone = 0
  enrichmentTotal = files.length

  const CONCURRENCY = 6
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < files.length) {
      if (enrichmentToken !== myToken) return
      const i = cursor++
      const node = files[i]
      try {
        const content = await GitHubClient.getBlob(node.sha)
        if (enrichmentToken !== myToken) return
        idx.replace({
          id: node.path,
          path: node.path,
          name: formatName(node.path),
          category: categorize(node.path),
          content,
        })
      } catch {
        // skip — this file just stays name-only in the index
      } finally {
        enrichmentDone++
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  if (enrichmentToken === myToken) {
    enriching = false
  }
}

function categorize(path: string): string {
  if (path.startsWith('wiki/people/')) return 'people'
  if (path.startsWith('wiki/projects/')) return 'projects'
  if (path.startsWith('wiki/issues/')) return 'issues'
  if (path.startsWith('wiki/notes/')) return 'notes'
  if (path.startsWith('markdown/')) return 'markdown'
  return 'other'
}

function formatName(path: string): string {
  const filename = path.split('/').pop() ?? path
  return filename.replace(/\.md$/, '')
}

/**
 * SearchIndex — builds a MiniSearch index from all wiki markdown files.
 * Fetches file tree + blob content, indexes name and content.
 */
export const SearchIndex = {
  /** Build or rebuild the search index */
  async build(): Promise<void> {
    if (building && buildPromise) return buildPromise

    building = true
    buildPromise = this._doBuild()

    try {
      await buildPromise
    } finally {
      building = false
      buildPromise = null
    }
  },

  async _doBuild(): Promise<void> {
    // Two-stage build: the /git/trees call gives every wiki path at once
    // so the index becomes searchable by name + path within a second.
    // Per-blob content fetches then enrich docs in the background so
    // 본문 search results fill in without blocking ready state.
    const sha = await GitHubClient.getLatestCommitSha()
    const tree = await GitHubClient.getTree(sha, true)

    const wikiFiles = tree.filter(
      (n: TreeNode) => n.type === 'blob' && n.path.endsWith('.md') && n.path.startsWith('wiki/'),
    )

    const newIndex = createIndex()
    newIndex.addAll(
      wikiFiles.map((node) => ({
        id: node.path,
        path: node.path,
        name: formatName(node.path),
        category: categorize(node.path),
        content: '',
      })),
    )

    index = newIndex

    // Kick off background stages; do not await.
    // Same token cancels both when the index is cleared/rebuilt.
    const token = ++enrichmentToken
    void enrichWithContent(wikiFiles, newIndex, token)
    void indexRecentSlates(newIndex, token)
  },

  /** Search the index */
  search(query: string, category?: string): SearchResult[] {
    if (!index || !query.trim()) return []

    // MiniSearch filter receives its own SearchResult type with stored fields as [key: string]: unknown
    const options = category
      ? { filter: (result: Record<string, unknown>) => result['category'] === category }
      : undefined

    const rawResults = index.search(query, options as Parameters<typeof index.search>[1])

    return rawResults.map((r) => ({
      path: r['path'] as string,
      name: r['name'] as string,
      category: r['category'] as string,
      terms: r.terms,
      score: r.score,
      date: r['date'] as string | undefined,
      slateId: r['slateId'] as string | undefined,
    }))
  },

  /** Full slate entry for a slate search result (keyed by its doc id / path). */
  getSlateEntry(docId: string): SlateEntry | undefined {
    return slateEntries.get(docId)
  },

  /** Whether the index has been built */
  get isReady(): boolean {
    return index !== null
  },

  /** Whether the index is currently building */
  get isBuilding(): boolean {
    return building
  },

  /** Number of indexed documents */
  get documentCount(): number {
    return index?.documentCount ?? 0
  },

  /** Whether background content enrichment is still running */
  get isEnriching(): boolean {
    return enriching
  },

  /** Background enrichment progress */
  get enrichmentProgress(): EnrichmentProgress {
    return { done: enrichmentDone, total: enrichmentTotal }
  },

  /** Whether recent-slate indexing is still running */
  get isIndexingSlates(): boolean {
    return slateIndexing
  },

  /** Recent-slate indexing progress (unit: journal days) */
  get slateProgress(): EnrichmentProgress {
    return { done: slateDone, total: slateTotal }
  },

  /** Drop the built index so the next build() starts fresh */
  clearIndex(): void {
    index = null
    enrichmentToken++ // cancel any in-flight enrichment + slate indexing
    enriching = false
    slateIndexing = false
    slateEntries.clear()
  },
} as const
