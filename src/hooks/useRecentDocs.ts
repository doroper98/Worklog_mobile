import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ww_recent_docs'
const MAX_RECENT = 20

export interface RecentDoc {
  path: string
  name: string
  /** Category derived from path (people/projects/issues/notes/markdown) */
  category: string
  /** Timestamp of last access */
  accessedAt: number
}

function loadRecent(): RecentDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentDoc[]
  } catch {
    return []
  }
}

function saveRecent(docs: RecentDoc[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
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

export function useRecentDocs() {
  const [docs, setDocs] = useState<RecentDoc[]>(loadRecent)

  /** Record a document access (moves it to top of LRU) */
  const recordAccess = useCallback((path: string) => {
    setDocs((prev) => {
      const filtered = prev.filter((d) => d.path !== path)
      const entry: RecentDoc = {
        path,
        name: formatName(path),
        category: categorize(path),
        accessedAt: Date.now(),
      }
      const next = [entry, ...filtered].slice(0, MAX_RECENT)
      saveRecent(next)
      return next
    })
  }, [])

  return { recentDocs: docs, recordAccess }
}
