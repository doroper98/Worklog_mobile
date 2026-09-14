import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import { GitHubImage } from '@/components/GitHubImage'
import { MarkdownBaseContext } from '@/components/MarkdownBaseContext'
import { MarkdownCodeBlock, MarkdownPre } from '@/components/MarkdownCodeBlock'
import { safeUrlTransform } from '@/utils/safeUrlTransform'
import {
  applyIslands,
  resetIslands,
  getIslandsDefault,
  setIslandsDefault,
} from '@/islands/applyIslands'

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

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // This is a read-only viewer — no editing or streaming state to guard.
    const cleanup = applyIslands(el, { docKey, enabled: islandsOn })
    return () => {
      cleanup()
      // Restore the original tables/mermaid blocks before React tears the
      // subtree down, so it never removes a node that moved underneath it.
      resetIslands(el)
    }
  }, [content, docKey, islandsOn])

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
    </>
  )
}
