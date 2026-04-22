import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { GitHubImage } from '@/components/GitHubImage'
import { MarkdownBaseContext } from '@/components/MarkdownBaseContext'
import { MarkdownCodeBlock } from '@/components/MarkdownCodeBlock'
import { MetaIndexService } from '@/services/MetaIndexService'
import type { MetaIndexEntry } from '@/services/MetaIndexService'
import { htmlToMarkdown } from '@/utils/htmlToMarkdown'
import { safeUrlTransform } from '@/utils/safeUrlTransform'

interface SlateMetaViewProps {
  slateId: string
  slateTitle: string
  /** Pre-generated markdown from CLI ingest */
  slateMarkdown: string
  /** Raw HTML content (fallback when markdown not available) */
  slateContent: string
  onBack: () => void
  onWikiTap: (path: string) => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

function EntityChip({
  label,
  category,
  onTap,
}: {
  label: string
  category: 'people' | 'projects' | 'issues'
  onTap: () => void
}) {
  const colors: Record<string, { bg: string; text: string; icon: 'users' | 'folder' | 'alert' }> = {
    people:   { bg: 'var(--color-personal)', text: 'var(--color-personal)', icon: 'users' },
    projects: { bg: 'var(--color-task)',     text: 'var(--color-task)',     icon: 'folder' },
    issues:   { bg: 'var(--color-meet)',     text: 'var(--color-meet)',     icon: 'alert' },
  }
  const c = colors[category]

  return (
    <button
      onClick={onTap}
      className="flex items-center gap-1.5 rounded-lg border-none px-2.5 py-1.5 text-left"
      style={{
        background: `color-mix(in srgb, ${c.bg} 10%, transparent)`,
        cursor: 'pointer',
      }}
    >
      <Icon name={c.icon} size={12} color={c.text} sw={1.8} />
      <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
        {label}
      </span>
      <Icon name="chev-right" size={10} color={c.text} sw={2} />
    </button>
  )
}

export function SlateMetaView({ slateId, slateTitle, slateMarkdown, slateContent, onBack, onWikiTap, onTabSelect, onFabTap }: SlateMetaViewProps) {
  const [entry, setEntry] = useState<MetaIndexEntry | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)

  useEffect(() => {
    MetaIndexService.findBySlateId(slateId)
      .then(setEntry)
      .finally(() => setMetaLoading(false))
  }, [slateId])

  // Use pre-generated markdown if available, fallback to HTML→MD conversion
  const markdownContent = useMemo(
    () => slateMarkdown || htmlToMarkdown(slateContent),
    [slateMarkdown, slateContent],
  )

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header */}
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
              {slateTitle}
            </div>
          </div>
          <span
            className="flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{
              background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)',
              color: 'var(--color-accent)',
            }}
          >
            MD
          </span>
        </div>
      </LiquidGlassSurface>

      {/* Body — single scrollable area: ingest summary + markdown body */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-4 py-4"
        style={{ paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {/* ── Ingest summary section (compact) ── */}
        {!metaLoading && entry && (
          <div className="mb-5 flex flex-col gap-3">
            {/* Summary */}
            {entry.summary && (
              <div
                className="rounded-2xl border p-3.5"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  요약
                </div>
                <div className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                  {entry.summary}
                </div>
              </div>
            )}

            {/* Entity chips row */}
            {(entry.people.length > 0 || entry.projects.length > 0 || entry.issues.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {entry.people.map((name) => (
                  <EntityChip key={`p-${name}`} label={name} category="people" onTap={() => onWikiTap(`wiki/people/${name}.md`)} />
                ))}
                {entry.projects.map((name) => (
                  <EntityChip key={`pr-${name}`} label={name} category="projects" onTap={() => onWikiTap(`wiki/projects/${name}.md`)} />
                ))}
                {entry.issues.map((name) => (
                  <EntityChip key={`i-${name}`} label={name} category="issues" onTap={() => onWikiTap(`wiki/issues/${name}.md`)} />
                ))}
              </div>
            )}

            {/* Decisions */}
            {entry.decisions.length > 0 && (
              <div
                className="rounded-2xl border p-3.5"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  결정사항 ({entry.decisions.length})
                </div>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {entry.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--color-accent)' }} />
                      <span className="text-[12.5px] leading-snug" style={{ color: 'var(--color-text)' }}>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Divider */}
            <div className="h-px" style={{ background: 'var(--color-hairline)' }} />
          </div>
        )}

        {/* ── Markdown body ── */}
        {markdownContent ? (
          <article className="ww-markdown px-1">
            <MarkdownBaseContext.Provider value="">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={safeUrlTransform}
                components={{ code: MarkdownCodeBlock, img: GitHubImage }}
              >
                {markdownContent}
              </ReactMarkdown>
            </MarkdownBaseContext.Provider>
          </article>
        ) : (
          <div
            className="rounded-2xl border border-dashed p-5 text-center"
            style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}
          >
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              본문이 비어 있습니다
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={onFabTap}
        className="absolute right-[22px] z-[45] flex h-14 w-14 items-center justify-center rounded-fab border-none"
        style={{
          bottom: 'calc(94px + var(--sai-bottom, 0px))',
          background: 'var(--color-accent)',
          color: 'var(--color-accent-text-on)',
          boxShadow: '0 10px 28px var(--color-accent-faint), 0 2px 8px rgba(0,0,0,0.18)',
        }}
      >
        <Icon name="pen" size={22} color="var(--color-accent-text-on)" sw={2.1} />
      </button>

      {/* Tab bar */}
      <LiquidGlassSurface
        level={2}
        className="absolute left-3.5 right-3.5 z-40 flex h-16 items-center justify-around overflow-hidden rounded-tab px-1.5"
        style={{ bottom: 'calc(14px + var(--sai-bottom, 0px))' }}
      >
        {TAB_ITEMS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabSelect(t.key)}
            className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Icon name={t.icon} size={22} sw={1.85} />
            <div className="text-[10px]" style={{ fontWeight: 500 }}>
              {t.label}
            </div>
          </button>
        ))}
      </LiquidGlassSurface>
    </div>
  )
}
