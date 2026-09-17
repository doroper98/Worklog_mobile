import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import { GitHubImage } from '@/components/GitHubImage'
import { MarkdownBaseContext } from '@/components/MarkdownBaseContext'
import { MarkdownCodeBlock, MarkdownPre } from '@/components/MarkdownCodeBlock'
import { readDiagram } from '@/services/DiagramFiles'
import { runMermaid } from '@/services/MermaidRunner'
import { applyTableViewMarkers } from '@/utils/tableViewMarkers'
import { safeUrlTransform } from '@/utils/safeUrlTransform'
import { fromMermaidDb } from '@/islands/mermaidFlowParser'
import type { FlowGraph } from '@/islands/mermaidFlowParser'
import {
  applyIslands,
  resetIslands,
  getIslandsDefault,
  setIslandsDefault,
} from '@/islands/applyIslands'

/**
 * Read a flowchart with mermaid's own parser rather than the island layer's
 * regex one, so shapes the regex misses still lay out correctly. Queued with
 * every other mermaid call — see MermaidRunner. A failure returns null and the
 * island layer keeps its own parse.
 */
function parseFlow(src: string): Promise<FlowGraph | null> {
  return runMermaid(async (mermaid) => {
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(src)
    if (!/^flowchart/.test(diagram.type)) return null
    return fromMermaidDb(diagram.db as Parameters<typeof fromMermaidDb>[0])
  }).catch(() => null)
}

const DRAWIO_VIEW = { readDiagram }

interface MarkdownBodyProps {
  content: string
  /** Document identity — islands remember the per-block view under this key. */
  docKey: string
  /** Base path used to resolve relative image URLs. */
  basePath?: string
  /** Syntax-highlight fenced code. Off for views that never showed it. */
  highlight?: boolean
  /** Extra classes for the markdown article. */
  className?: string
}

/**
 * Markdown body shared by every reading view.
 *
 * Renders the document inside `.md-content` and hands the surrounding element
 * to applyIslands, which rewrites qualifying tables and mermaid blocks into
 * islands. The markdown source is never touched — islands are pure render
 * post-processing, so the stored file, the wiki and search all stay identical.
 *
 * The container is keyed by the document so React replaces it wholesale when
 * the content changes. That matters because applyIslands detaches original
 * tables and moves mermaid blocks; letting React reconcile in place over those
 * mutations would have it patch nodes that are no longer where it left them.
 */
export function MarkdownBody({
  content,
  docKey,
  basePath = '',
  highlight = true,
  className,
}: MarkdownBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [islandsOn, setIslandsOn] = useState(() => getIslandsDefault() === 'island')
  const [notice, setNotice] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Hand the stored per-table view to applyIslands, which expects it as a
    // Comment node the way marked leaves it.
    applyTableViewMarkers(el, content)
    // This is a read-only viewer — no editing or streaming state to guard.
    //
    // No onViewChange: writing a view marker means rewriting the document, and
    // this app may only write under inbox/. So switching a block here changes
    // the screen and nothing else, and the reader is told so.
    const cleanup = applyIslands(el, {
      docKey,
      enabled: islandsOn,
      parseFlow,
      drawioView: DRAWIO_VIEW,
    })
    return () => {
      cleanup()
      // Restore the original tables/mermaid blocks before React tears the
      // subtree down, so it never removes a node that moved underneath it.
      resetIslands(el)
    }
  }, [content, docKey, islandsOn])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timer = 0
    const onClick = (ev: Event) => {
      if (!(ev.target as HTMLElement | null)?.closest('.ww-sw button')) return
      setNotice(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setNotice(false), 3000)
    }
    el.addEventListener('click', onClick)
    return () => {
      el.removeEventListener('click', onClick)
      window.clearTimeout(timer)
    }
  }, [content, docKey])

  const toggleIslands = useCallback(() => {
    setIslandsOn((on) => {
      const next = !on
      setIslandsDefault(next ? 'island' : 'raw')
      return next
    })
  }, [])

  return (
    <>
      <div className="mb-1.5 flex justify-end">
        <button
          onClick={toggleIslands}
          aria-pressed={islandsOn}
          className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: islandsOn ? 'var(--color-accent-soft)' : 'transparent',
            borderColor: islandsOn ? 'var(--color-accent)' : 'var(--color-border)',
            color: islandsOn ? 'var(--color-accent)' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          섬 {islandsOn ? 'ON' : 'OFF'}
        </button>
      </div>
      <article className={className ? `ww-markdown ${className}` : 'ww-markdown'}>
        <div key={`${docKey}|${content.length}`} ref={containerRef}>
          <div className="md-content">
            <MarkdownBaseContext.Provider value={basePath}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={highlight ? [[rehypeHighlight, { plainText: ['mermaid'], ignoreMissing: true }]] : []}
                urlTransform={safeUrlTransform}
                components={{ code: MarkdownCodeBlock, pre: MarkdownPre, img: GitHubImage }}
              >
                {content}
              </ReactMarkdown>
            </MarkdownBaseContext.Provider>
          </div>
        </div>
      </article>
      {notice && (
        <div
          role="status"
          className="fixed inset-x-0 z-50 flex justify-center px-4"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
        >
          <span
            className="rounded-full border px-3 py-1.5 text-[12px]"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-sec)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            이 화면에서는 저장되지 않습니다
          </span>
        </div>
      )}
    </>
  )
}
