import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'

interface MarkdownViewProps {
  title: string
  path: string
  content: string
  loading: boolean
  onBack: () => void
}

/**
 * Document viewer — maps to SlateDetail26 from handoff bundle.
 * Full-screen view with glass header and markdown body.
 */
export function MarkdownView({ title, path, content, loading, onBack }: MarkdownViewProps) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header — glass level 1 */}
      <LiquidGlassSurface
        level={1}
        className="relative z-10 px-4 pb-3"
        style={{ paddingTop: 'calc(16px + var(--sai-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] border-none bg-transparent"
            style={{ color: 'var(--color-accent)' }}
          >
            <Icon name="chev-left" size={20} sw={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-display text-lg font-bold leading-tight tracking-tight"
              style={{ color: 'var(--color-text)' }}
            >
              {title}
            </div>
            <div
              className="mt-0.5 truncate font-mono text-[10px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {path}
            </div>
          </div>
        </div>
      </LiquidGlassSurface>

      {/* Body */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-5 py-4"
        style={{ background: 'var(--color-bg2)' }}
      >
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-3 rounded"
                style={{
                  background: 'var(--color-skel)',
                  width: `${80 - i * 10}%`,
                }}
              />
            ))}
          </div>
        ) : (
          <article className="ww-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {content}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  )
}
