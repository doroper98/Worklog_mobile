import { useRef, useEffect } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { useSearch } from '@/hooks/useSearch'
import { SearchIndex } from '@/services/SearchIndex'
import type { SearchResult } from '@/services/SearchIndex'
import type { SlateEntry } from '@/services/CalendarService'

// ─── Types ──────────────────────────────────────────────────────────────

interface SearchViewProps {
  onFileTap: (path: string) => void
  /** Open a slate search result (recent-journal slates) */
  onSlateTap?: (slate: SlateEntry) => void
  onBack: () => void
}

const CATEGORY_FILTERS = [
  { key: undefined as string | undefined, label: '전체' },
  { key: 'slate', label: '슬레이트' },
  { key: 'people', label: 'People' },
  { key: 'projects', label: 'Projects' },
  { key: 'issues', label: 'Issues' },
  { key: 'notes', label: 'Notes' },
]

const CATEGORY_COLORS: Record<string, string> = {
  people: '--color-personal',
  projects: '--color-task',
  issues: '--color-meet',
  notes: '--color-memo',
  markdown: '--color-daily',
  slate: '--color-daily',
}

// ─── Highlight helper ───────────────────────────────────────────────────

function highlightTerms(text: string, terms: string[]): React.ReactNode {
  if (terms.length === 0) return text

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const isMatch = terms.some((t) => part.toLowerCase() === t.toLowerCase())
    if (isMatch) {
      return (
        <mark
          key={i}
          style={{
            background: 'var(--color-accent-soft)',
            color: 'var(--color-accent)',
            borderRadius: 2,
            padding: '0 1px',
          }}
        >
          {part}
        </mark>
      )
    }
    return part
  })
}

// ─── Result item ────────────────────────────────────────────────────────

function ResultItem({
  result,
  onTap,
}: {
  result: SearchResult
  onTap: () => void
}) {
  const colorVar = CATEGORY_COLORS[result.category] ?? '--color-accent'

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-2.5 border-none bg-transparent px-4 py-2.5 text-left"
      style={{
        borderBottom: '1px solid var(--color-hairline)',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: `var(${colorVar})` }}
      />
      <span
        className="w-14 flex-shrink-0 font-mono text-[9px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {result.category === 'slate' && result.date
          ? result.date.slice(5) // MM-DD
          : result.category}
      </span>
      <div
        className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
        style={{ color: 'var(--color-text)', letterSpacing: '-0.015em' }}
      >
        {highlightTerms(result.name, result.terms)}
      </div>
      <Icon name="chev-right" size={14} color="var(--color-text-faint)" sw={2} />
    </button>
  )
}

// ─── SearchView ─────────────────────────────────────────────────────────

export function SearchView({ onFileTap, onSlateTap, onBack }: SearchViewProps) {
  const {
    query, setQuery,
    results,
    categoryFilter, setCategoryFilter,
    indexReady, indexBuilding,
    enriching, enrichmentProgress,
    slateIndexing, slateProgress,
  } = useSearch()

  const handleResultTap = (r: SearchResult) => {
    if (r.category === 'slate') {
      const entry = SearchIndex.getSlateEntry(r.path)
      if (entry && onSlateTap) onSlateTap(entry)
      return
    }
    onFileTap(r.path)
  }

  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header — glass search bar */}
      <LiquidGlassSurface level={1} className="relative z-10 px-4 pb-3 pt-16">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border-none bg-transparent"
            style={{ color: 'var(--color-accent)' }}
          >
            <Icon name="chev-left" size={20} sw={2.2} />
          </button>
          <div
            className="flex flex-1 items-center gap-2 rounded-[12px] px-3 py-2"
            style={{ background: 'var(--color-surface-alt)' }}
          >
            <Icon name="search" size={16} color="var(--color-text-muted)" sw={2} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="위키·슬레이트·인물 검색"
              className="flex-1 border-none bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="flex h-5 w-5 items-center justify-center rounded-full border-none"
                style={{ background: 'var(--color-surface)', cursor: 'pointer' }}
              >
                <Icon name="x" size={12} color="var(--color-text-muted)" sw={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Category filters */}
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
          {CATEGORY_FILTERS.map((f) => {
            const active = categoryFilter === f.key
            return (
              <button
                key={f.label}
                onClick={() => setCategoryFilter(f.key)}
                className="flex-shrink-0 rounded-full border-none px-3 py-1.5 text-[11px] font-semibold"
                style={{
                  background: active ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: active ? 'var(--color-accent-text-on)' : 'var(--color-text-sec)',
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </LiquidGlassSurface>

      {/* Results */}
      <div
        className="relative z-[1] flex-1 overflow-auto"
        style={{ background: 'var(--color-bg2)' }}
      >
        {indexBuilding && (
          <div className="px-5 py-8 text-center">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              검색 인덱스 준비 중...
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              파일 목록을 불러오고 있습니다.
            </div>
          </div>
        )}

        {indexReady && enriching && enrichmentProgress.total > 0 && (
          <div
            className="flex items-center justify-center gap-2 px-5 py-2 font-mono text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>본문 검색 인덱싱</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {enrichmentProgress.done} / {enrichmentProgress.total}
            </span>
            <div
              className="h-0.5 w-16 overflow-hidden rounded"
              style={{ background: 'var(--color-surface-alt)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${(enrichmentProgress.done / enrichmentProgress.total) * 100}%`,
                  background: 'var(--color-accent)',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
          </div>
        )}

        {indexReady && slateIndexing && slateProgress.total > 0 && (
          <div
            className="flex items-center justify-center gap-2 px-5 py-1 font-mono text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>슬레이트 인덱싱 (최근 30일)</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {slateProgress.done} / {slateProgress.total}
            </span>
            <div
              className="h-0.5 w-16 overflow-hidden rounded"
              style={{ background: 'var(--color-surface-alt)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${(slateProgress.done / slateProgress.total) * 100}%`,
                  background: 'var(--color-daily)',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>
          </div>
        )}

        {indexReady && !query && (
          <div className="px-5 py-8 text-center">
            <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              검색어를 입력하세요
            </div>
          </div>
        )}

        {indexReady && query && results.length === 0 && (
          <div className="px-5 py-8 text-center">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              "{query}" 결과 없음
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              다른 검색어를 시도해보세요.
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <div
              className="px-5 py-2 font-mono text-[10px] font-bold"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {results.length} results
            </div>
            <div
              className="mx-4 overflow-hidden rounded-2xl border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              {results.map((r) => (
                <ResultItem
                  key={r.path}
                  result={r}
                  onTap={() => handleResultTap(r)}
                />
              ))}
            </div>
            <div className="h-6" />
          </div>
        )}
      </div>
    </div>
  )
}
