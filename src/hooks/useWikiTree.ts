import { useState, useEffect, useCallback } from 'react'

import { GitHubClient } from '@/services/GitHubClient'
import type { TreeNode } from '@/types'

export interface WikiCategory {
  key: 'people' | 'projects' | 'issues' | 'notes'
  title: string
  count: number
  files: TreeNode[]
}

interface UseWikiTreeResult {
  categories: WikiCategory[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const CATEGORY_KEYS = ['people', 'projects', 'issues', 'notes'] as const

export function useWikiTree(): UseWikiTreeResult {
  const [categories, setCategories] = useState<WikiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sha = await GitHubClient.getLatestCommitSha()
      const tree = await GitHubClient.getTree(sha, true)

      const cats: WikiCategory[] = CATEGORY_KEYS.map((key) => {
        const prefix = `wiki/${key}/`
        const files = tree.filter(
          (n) => n.type === 'blob' && n.path.startsWith(prefix) && n.path.endsWith('.md'),
        )
        return {
          key,
          title: key.charAt(0).toUpperCase() + key.slice(1),
          count: files.length,
          files,
        }
      })

      setCategories(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wiki 트리를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { categories, loading, error, refresh: load }
}
