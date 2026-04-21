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

let index: MiniSearch<SearchDocument> | null = null
let building = false
let buildPromise: Promise<void> | null = null

function createIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ['name', 'content'],
    storeFields: ['path', 'name', 'category'],
    searchOptions: {
      boost: { name: 3 },
      prefix: true,
      fuzzy: 0.2,
    },
  })
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
    const sha = await GitHubClient.getLatestCommitSha()
    const tree = await GitHubClient.getTree(sha, true)

    // Filter to wiki .md files
    const wikiFiles = tree.filter(
      (n: TreeNode) => n.type === 'blob' && n.path.endsWith('.md') && n.path.startsWith('wiki/'),
    )

    const newIndex = createIndex()

    // Fetch content for each file (in batches to avoid rate limiting)
    const BATCH_SIZE = 10
    for (let i = 0; i < wikiFiles.length; i += BATCH_SIZE) {
      const batch = wikiFiles.slice(i, i + BATCH_SIZE)
      const docs = await Promise.all(
        batch.map(async (node) => {
          try {
            const content = await GitHubClient.getBlob(node.sha)
            return {
              id: node.path,
              path: node.path,
              name: formatName(node.path),
              category: categorize(node.path),
              content,
            }
          } catch {
            return {
              id: node.path,
              path: node.path,
              name: formatName(node.path),
              category: categorize(node.path),
              content: '',
            }
          }
        }),
      )
      newIndex.addAll(docs)
    }

    index = newIndex
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

  /** Drop the built index so the next build() starts fresh */
  clearIndex(): void {
    index = null
  },
} as const
