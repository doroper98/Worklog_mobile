import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { useReports } from '@/hooks/useReports'
import { formatReportRange } from '@/utils/reportFormat'
import type { ReportSummary } from '@/services/ReportsService'

interface ReportsViewProps {
  onBack: () => void
  onReportTap: (summary: ReportSummary) => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

export function ReportsView({ onBack, onReportTap, onTabSelect, onFabTap }: ReportsViewProps) {
  const { reports, loading, error } = useReports()

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
              주간보고
            </div>
            <div
              className="mt-0.5 truncate font-mono text-[10px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {loading ? '불러오는 중…' : `${reports.length}건`}
            </div>
          </div>
        </div>
      </LiquidGlassSurface>

      {/* Body */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-4 py-4"
        style={{ paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[62px] rounded-2xl"
                style={{ background: 'var(--color-skel)' }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-2xl border border-dashed p-5 text-center"
            style={{ borderColor: 'var(--color-danger)', background: 'var(--color-surface)' }}
          >
            <div className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
              주간보고를 불러올 수 없습니다
            </div>
            <div className="mt-1.5 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {error}
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed p-[22px_18px]"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)' }}
          >
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              아직 주간보고가 없습니다
            </div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              데스크탑에서 주간 레포트를 생성하면 여기에 최신순으로 나타납니다.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => onReportTap(r)}
                className="flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  boxShadow: 'var(--glass-shadow)',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
                  style={{
                    background: 'color-mix(in srgb, var(--color-daily) 12%, transparent)',
                    color: 'var(--color-daily)',
                  }}
                >
                  <Icon name="calendar" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate font-display text-[15px] font-bold tracking-tight"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatReportRange(r.dateFrom, r.dateTo)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {r.dateFrom} ~ {r.dateTo}
                    </span>
                    {r.source === 'wiki-notes' && (
                      <span
                        className="rounded px-1 py-0.5 font-mono text-[8px] font-bold uppercase"
                        style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
                      >
                        notes
                      </span>
                    )}
                  </div>
                </div>
                <Icon name="chev-right" size={16} color="var(--color-text-faint)" sw={2} />
              </button>
            ))}
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
