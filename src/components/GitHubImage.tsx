import { useContext, useEffect, useState, type ComponentPropsWithoutRef } from 'react'

import { MarkdownBaseContext } from '@/components/MarkdownBaseContext'
import { GitHubClient } from '@/services/GitHubClient'

/** repo path → object URL, preserved across component remounts */
const blobCache = new Map<string, string>()

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
}

function guessMime(path: string): string {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

function extractRepoPath(url: string): string | null {
  const raw = url.match(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/([^?#]+)/)
  if (raw) return raw[1]
  const blob = url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:blob|raw)\/[^/]+\/([^?#]+)/)
  if (blob) return blob[1]
  return null
}

function resolveRelative(src: string, basePath: string): string {
  if (src.startsWith('/')) return src.replace(/^\/+/, '')
  const parts = basePath.split('/').filter(Boolean)
  for (const segment of src.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

type ImgProps = ComponentPropsWithoutRef<'img'>

/**
 * <img> replacement that fetches repo-hosted images via the GitHub
 * Contents API (so PAT auth works) and exposes them as blob: URLs.
 * data: and non-repo URLs pass through untouched.
 */
export function GitHubImage({ src, alt, ...rest }: ImgProps) {
  const basePath = useContext(MarkdownBaseContext)
  const [resolved, setResolved] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [debug, setDebug] = useState<{ src: string; repoPath: string | null; error?: string } | null>(null)

  useEffect(() => {
    setFailed(false)
    setDebug(null)

    if (!src) {
      setFailed(true)
      setDebug({ src: '(empty)', repoPath: null, error: 'src missing' })
      return
    }

    // Data / blob URLs render directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setResolved(src)
      return
    }

    let repoPath: string | null = null
    if (/^https?:\/\//i.test(src)) {
      repoPath = extractRepoPath(src)
      if (!repoPath) {
        // External host — let the browser try on its own
        setResolved(src)
        return
      }
    } else {
      repoPath = resolveRelative(src, basePath)
    }

    if (!repoPath) {
      setFailed(true)
      setDebug({ src, repoPath: null, error: 'could not resolve to repo path' })
      return
    }

    const cached = blobCache.get(repoPath)
    if (cached) {
      setResolved(cached)
      return
    }

    let cancelled = false
    GitHubClient.getBinaryFile(repoPath)
      .then((bytes) => {
        if (cancelled) return
        const blob = new Blob([bytes], { type: guessMime(repoPath!) })
        const url = URL.createObjectURL(blob)
        blobCache.set(repoPath!, url)
        setResolved(url)
      })
      .catch((err) => {
        if (cancelled) return
        setFailed(true)
        setDebug({ src, repoPath, error: err instanceof Error ? err.message : String(err) })
      })

    return () => { cancelled = true }
  }, [src, basePath])

  if (failed) {
    return (
      <span
        className="my-2 block overflow-auto rounded border px-2 py-2 font-mono text-[10px]"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-danger)',
          color: 'var(--color-text-muted)',
          wordBreak: 'break-all',
        }}
      >
        <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
          [이미지 로드 실패{alt ? `: ${alt}` : ''}]
        </span>
        {debug && (
          <>
            <br />src: <span style={{ color: 'var(--color-text)' }}>{debug.src}</span>
            <br />base: <span style={{ color: 'var(--color-text)' }}>{basePath || '(root)'}</span>
            {debug.repoPath && (
              <>
                <br />resolved: <span style={{ color: 'var(--color-text)' }}>{debug.repoPath}</span>
              </>
            )}
            {debug.error && (
              <>
                <br />error: <span style={{ color: 'var(--color-text)' }}>{debug.error}</span>
              </>
            )}
          </>
        )}
      </span>
    )
  }

  if (!resolved) {
    return (
      <span
        className="my-2 inline-block rounded border px-2 py-1 font-mono text-[11px]"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        [이미지 로딩…]
      </span>
    )
  }

  return <img src={resolved} alt={alt} loading="lazy" {...rest} />
}
