import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { ReportsService } from '@/services/ReportsService'
import type { ReportSummary, WeeklyReport } from '@/services/ReportsService'
import { parseReportSections } from '@/utils/reportSections'
import type { ReportSection } from '@/utils/reportSections'
import { formatReportRange } from '@/utils/reportFormat'
import { bridgeToClaude } from '@/utils/bridgeToClaude'

interface ReportDetailViewProps {
  summary: ReportSummary
  onBack: () => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

// ─── Collapsible bracket section ──────────────────────────────────────────

function SectionCard({ section, defaultOpen }: { section: ReportSection; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
    >
      {section.title && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between border-none bg-transparent px-4 py-3 text-left"
          style={{ cursor: 'pointer' }}
        >
          <span className="font-display text-[14px] font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            {section.title}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              {section.items.length}
            </span>
            <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--color-text-muted)' }}>
              <Icon name="chev-right" size={14} sw={2.2} />
            </span>
          </div>
        </button>
      )}
      {open && (
        <div style={{ borderTop: section.title ? '1px solid var(--color-hairline)' : 'none' }}>
          {section.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-4 py-2.5"
              style={{ borderBottom: i < section.items.length - 1 ? '1px solid var(--color-hairline)' : 'none' }}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: item.due ? 'var(--color-warning)' : 'var(--color-text-faint)' }}
              />
              <span className="min-w-0 flex-1 text-[13.5px] leading-relaxed" style={{ color: 'var(--color-text)' }}>
                {item.text}
              </span>
              {item.date && (
                <span
                  className="flex-shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums"
                  style={{
                    background: item.due
                      ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)'
                      : 'var(--color-surface-alt)',
                    color: item.due ? 'var(--color-warning)' : 'var(--color-text-muted)',
                  }}
                >
                  {item.due ? `~${item.date}` : item.date}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ReportDetailView ─────────────────────────────────────────────────────

export function ReportDetailView({ summary, onBack, onTabSelect, onFabTap }: ReportDetailViewProps) {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bridged, setBridged] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    ReportsService.getReport(summary)
      .then((r) => { if (alive) setReport(r) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : '보고서를 불러올 수 없습니다.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [summary])

  const handleBridge = useCallback(async () => {
    if (!report) return
    const range = formatReportRange(report.dateFrom, report.dateTo)
    const prompt = `다음은 ${range} 주간보고입니다. 핵심만 요약해줘.\n\n${report.content}`
    await bridgeToClaude(prompt)
    setBridged(true)
    setTimeout(() => setBridged(false), 1600)
  }, [report])

  const sections = report ? parseReportSections(report.content) : null

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
              {formatReportRange(summary.dateFrom, summary.dateTo)}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
              주간보고 · {summary.dateFrom} ~ {summary.dateTo}
            </div>
          </div>
          <button
            onClick={handleBridge}
            disabled={!report}
            className="flex h-8 items-center gap-1 rounded-full border-none px-3"
            style={{
              background: bridged ? 'var(--color-success)' : 'var(--color-accent-soft)',
              color: bridged ? 'var(--color-accent-text-on)' : 'var(--color-accent)',
              cursor: report ? 'pointer' : 'default',
              opacity: report ? 1 : 0.5,
            }}
          >
            <Icon name={bridged ? 'check' : 'arrow-up'} size={13} sw={2.4} color={bridged ? 'var(--color-accent-text-on)' : 'var(--color-accent)'} />
            <span className="text-[12px] font-semibold">{bridged ? '복사됨' : 'Claude'}</span>
          </button>
        </div>
      </LiquidGlassSurface>

      {/* Body */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-4 py-4"
        style={{ background: 'var(--color-bg2)', paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[90px] rounded-2xl" style={{ background: 'var(--color-skel)' }} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: 'var(--color-danger)', background: 'var(--color-surface)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
              보고서를 불러올 수 없습니다
            </div>
            <div className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {error}
            </div>
          </div>
        ) : sections ? (
          <div className="flex flex-col gap-2.5">
            {sections.map((section, i) => (
              <SectionCard key={i} section={section} defaultOpen />
            ))}
          </div>
        ) : (
          <article className="ww-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report?.content ?? ''}
            </ReactMarkdown>
          </article>
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
