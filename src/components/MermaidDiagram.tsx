import { useEffect, useRef, useState, useId } from 'react'

import { useTheme } from '@/hooks/useTheme'

type MermaidApi = typeof import('mermaid')['default']

let mermaidApi: MermaidApi | null = null
let loadPromise: Promise<MermaidApi> | null = null

function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return Promise.resolve(mermaidApi)
  if (loadPromise) return loadPromise
  loadPromise = import('mermaid').then((m) => {
    mermaidApi = m.default
    return mermaidApi
  })
  return loadPromise
}

interface Props {
  source: string
}

/**
 * Render a Mermaid flowchart. The mermaid library (~150 KB gzip) is
 * loaded on first use via dynamic import so users who never open a
 * diagram pay no bundle cost.
 */
export function MermaidDiagram({ source }: Props) {
  const { effectiveTheme } = useTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const reactId = useId()
  const renderId = `ww-mm-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`

  useEffect(() => {
    let cancelled = false

    loadMermaid()
      .then((mermaid) => {
        if (cancelled) return
        mermaid.initialize({
          startOnLoad: false,
          theme: effectiveTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'strict',
          flowchart: { htmlLabels: true, curve: 'basis' },
          fontFamily: 'inherit',
        })
        return mermaid.render(renderId, source)
      })
      .then((result) => {
        if (cancelled || !result) return
        if (hostRef.current) hostRef.current.innerHTML = result.svg
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => { cancelled = true }
  }, [source, effectiveTheme, renderId])

  if (error) {
    return (
      <div
        className="my-3 overflow-auto rounded-xl border p-3 font-mono text-[11px]"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-danger)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div className="mb-1.5 font-bold" style={{ color: 'var(--color-danger)' }}>
          Mermaid 렌더링 실패
        </div>
        <div className="mb-2 whitespace-pre-wrap">{error}</div>
        <pre className="m-0 whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
          {source}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="ww-mermaid my-3 overflow-auto rounded-xl border p-3"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    />
  )
}
