import MiniSearch from 'minisearch'

import { GitHubClient } from '@/services/GitHubClient'
import type { TreeNode } from '@/types'

export interface SearchDocument {
  id: string
  path: string
  name: string
  category: string
  content: string
}

export interface SearchResult {
  path: string
  name: string
  category: string
  /** Matched terms for highlighting */
  terms: string[]
  score: number
}

export interface EnrichmentProgress {
  done: number
  total: number
}

let index: MiniSearch<SearchDocument> | null = null
let building = false
let buildPromise: Promise<void> | null = null

let enriching = false
let enrichmentDone = 0
let enrichmentTotal = 0
let enrichmentToken = 0

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ['name', 'path', 'content'],
    storeFields: ['path', 'name', 'category'],
    searchOptions: {
      boost: { name: 3, path: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
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

    // Kick off background content enrichment; do not await
    enrichmentToken++
    void enrichWithContent(wikiFiles, newIndex, enrichmentToken)
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
    }))
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

  /** Drop the built index so the next build() starts fresh */
  clearIndex(): void {
    index = null
    enrichmentToken++ // cancel any in-flight enrichment
    enriching = false
  },
} as const
