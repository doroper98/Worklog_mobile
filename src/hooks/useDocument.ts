import { useState, useCallback } from 'react'

import { GitHubClient } from '@/services/GitHubClient'
import type { FileContent } from '@/types'

interface DocumentData {
  path: string
  name: string
  content: string
  sha: string
}

interface UseDocumentResult {
  document: DocumentData | null
  loading: boolean
  error: string | null
  loadDocument: (path: string) => Promise<void>
  clearDocument: () => void
}

export function useDocument(): UseDocumentResult {
  const [document, setDocument] = useState<DocumentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDocument = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = (await GitHubClient.getContents(path)) as FileContent
      const content = atob(data.content.replace(/\n/g, ''))
      // UTF-8 decode
      const decoded = decodeURIComponent(
        content.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
      )
      setDocument({
        path: data.path,
        name: data.name.replace(/\.md$/, ''),
        content: decoded,
        sha: data.sha,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearDocument = useCallback(() => {
    setDocument(null)
    setError(null)
  }, [])

  return { document, loading, error, loadDocument, clearDocument }
}
