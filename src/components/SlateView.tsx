import { useMemo } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { SlateEntry } from '@/services/CalendarService'

interface SlateViewProps {
  slate: SlateEntry
  onBack: () => void
}

const SLATE_TYPE_META: Record<string, { icon: 'users' | 'folder' | 'file' | 'alert'; colorVar: string; label: string }> = {
  meeting:  { icon: 'users',  colorVar: '--color-meet',     label: '회의' },
  task:     { icon: 'folder', colorVar: '--color-task',     label: '업무' },
  memo:     { icon: 'file',   colorVar: '--color-memo',     label: '메모' },
  personal: { icon: 'alert', colorVar: '--color-personal', label: '개인' },
}

/** Sanitize HTML: strip script tags and event handlers */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=')
}

/** Format datetime string to readable format */
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

export function SlateView({ slate, onBack }: SlateViewProps) {
  const meta = SLATE_TYPE_META[slate.type] ?? SLATE_TYPE_META.memo
  const safeHtml = useMemo(() => sanitizeHtml(slate.content), [slate.content])

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

      {/* Content */}
      <div
        className="flex-1 overflow-auto px-5 pb-10 pt-5"
        style={{ paddingBottom: 'calc(40px + var(--sai-bottom, 0px))' }}
      >
        <div
          className="slate-content text-[14.5px] leading-relaxed"
          style={{ color: 'var(--color-text)' }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>

      {/* Inline styles for slate HTML content */}
      <style>{`
        .slate-content p {
          margin-bottom: 0.6em;
        }
        .slate-content p:last-child {
          margin-bottom: 0;
        }
        .slate-content .tcc-mention {
          color: var(--color-accent);
          font-weight: 600;
        }
        .slate-content .tcc-slate-ref {
          color: var(--color-accent);
          font-weight: 500;
          text-decoration: none;
        }
        .slate-content ul, .slate-content ol {
          padding-left: 1.4em;
          margin-bottom: 0.6em;
        }
        .slate-content li {
          margin-bottom: 0.3em;
        }
        .slate-content strong {
          font-weight: 700;
        }
        .slate-content a {
          color: var(--color-accent);
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
