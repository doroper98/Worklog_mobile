import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { SlateEntry } from '@/services/CalendarService'

interface SlateViewProps {
  slate: SlateEntry
  onBack: () => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const SLATE_TYPE_META: Record<string, { icon: 'users' | 'folder' | 'file' | 'alert'; colorVar: string; label: string }> = {
  meeting:  { icon: 'users',  colorVar: '--color-meet',     label: '회의' },
  task:     { icon: 'folder', colorVar: '--color-task',     label: '업무' },
  memo:     { icon: 'file',   colorVar: '--color-memo',     label: '메모' },
  personal: { icon: 'alert', colorVar: '--color-personal', label: '개인' },
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    const mm = d.getMonth() + 1
    const dd = d.getDate()
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}/${dd} ${hh}:${mi}`
  } catch {
    return iso
  }
}

/** Convert HTML content to plain text / pseudo-markdown for ReactMarkdown */
function htmlToMarkdown(html: string): string {
  if (!html) return ''
  let md = html
    // Block elements to newlines
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/h([1-6])>/gi, '\n\n')
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => '#'.repeat(Number(level)) + ' ')
    // Bold / italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Mentions (preserve as bold)
    .replace(/<span[^>]*class="tcc-mention"[^>]*>([\s\S]*?)<\/span>/gi, '**$1**')
    // Code
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return md
}

export function SlateView({ slate, onBack, onTabSelect, onFabTap }: SlateViewProps) {
  const meta = SLATE_TYPE_META[slate.type] ?? SLATE_TYPE_META.memo
  const markdownContent = htmlToMarkdown(slate.content)

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
              {slate.title}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                style={{
                  background: `color-mix(in srgb, var(${meta.colorVar}) 12%, transparent)`,
                }}
              >
                <Icon name={meta.icon} size={11} color={`var(${meta.colorVar})`} sw={1.8} />
                <span
                  className="text-[10px] font-bold"
                  style={{ color: `var(${meta.colorVar})` }}
                >
                  {meta.label}
                </span>
              </div>
              <span
                className="font-mono text-[10px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {formatDateTime(slate.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </LiquidGlassSurface>

      {/* Content — markdown rendered */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-5 py-4"
        style={{
          background: 'var(--color-bg2)',
          paddingBottom: 'calc(96px + var(--sai-bottom, 0px))',
        }}
      >
        <article className="ww-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {markdownContent}
          </ReactMarkdown>
        </article>
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
