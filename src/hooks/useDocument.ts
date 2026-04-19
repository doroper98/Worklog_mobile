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
      let decoded: string

      if (data.content) {
        // Normal case: file < 1 MB, content is base64 inline
        const binary = atob(data.content.replace(/\n/g, ''))
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
        decoded = new TextDecoder('utf-8').decode(bytes)
      } else if (data.sha) {
        // Large file (> 1 MB): use Blob API
        decoded = await GitHubClient.getBlob(data.sha)
      } else {
        throw new Error('파일 내용을 가져올 수 없습니다.')
      }

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
