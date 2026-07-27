import { useState, useEffect, useCallback } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { SentMemoStore } from '@/services/SentMemoStore'
import type { SentMemo } from '@/services/SentMemoStore'
import { InboxStatusService } from '@/services/InboxStatusService'
import type { ProcessedRecord } from '@/services/InboxStatusService'

interface InboxSentViewProps {
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
  /** Navigate to a journal date (from a reflected memo). */
  onOpenDate?: (dateStr: string) => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

const KIND_LABEL: Record<string, string> = {
  memo: '메모',
  meeting: '회의',
  task: '할일',
  append: '이어쓰기',
}

type Status = 'sent' | 'reflected' | 'discarded'

function statusOf(rec: ProcessedRecord | undefined): Status {
  if (!rec) return 'sent'
  if (rec.action === 'discard') return 'discarded'
  return 'reflected'
}

// ─── Sent row ──────────────────────────────────────────────────────────────

function SentRow({
  memo,
  rec,
  last,
  onOpenDate,
}: {
  memo: SentMemo
  rec: ProcessedRecord | undefined
  last: boolean
  onOpenDate?: (dateStr: string) => void
}) {
  const status = statusOf(rec)
  const reflected = status === 'reflected'
  const journalDate = rec?.journalDate ?? memo.targetDate
  const tappable = reflected && Boolean(onOpenDate)

  return (
    <button
      onClick={tappable ? () => onOpenDate?.(journalDate) : undefined}
      className="flex w-full items-start gap-3 border-none bg-transparent px-4 py-3 text-left"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-hairline)',
        cursor: tappable ? 'pointer' : 'default',
      }}
    >
      {/* Status indicator */}
      <span className="mt-1 flex-shrink-0">
        {status === 'reflected' ? (
          <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: 'var(--color-success)' }}>
            <Icon name="check" size={11} color="var(--color-accent-text-on)" sw={3} />
          </span>
        ) : (
          <span
            className="block h-2.5 w-2.5 rounded-full"
            style={{ background: status === 'discarded' ? 'var(--color-text-faint)' : 'var(--color-text-muted)', marginTop: 2, marginLeft: 3 }}
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13.5px] font-medium"
          style={{
            color: 'var(--color-text)',
            textDecoration: status === 'discarded' ? 'line-through' : 'none',
            opacity: status === 'discarded' ? 0.6 : 1,
          }}
        >
          {memo.title || '(제목 없음)'}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className="rounded px-1 py-0.5 font-mono text-[9px] font-bold uppercase"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
          >
            {KIND_LABEL[memo.kind] ?? memo.kind}
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
            {reflected ? `${journalDate} 일지에 반영` : status === 'discarded' ? '보류됨' : `전송됨 · ${memo.targetDate}`}
          </span>
        </div>
      </div>

      {reflected && <Icon name="chev-right" size={16} color="var(--color-text-faint)" sw={2} />}
    </button>
  )
}

// ─── InboxSentView ───────────────────────────────────────────────────────────

export function InboxSentView({ onTabSelect, onFabTap, onOpenDate }: InboxSentViewProps) {
  const [memos, setMemos] = useState<SentMemo[]>([])
  const [processed, setProcessed] = useState<Map<string, ProcessedRecord>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setMemos(SentMemoStore.list())
    try {
      const map = await InboxStatusService.getProcessedMap()
      setProcessed(map)
    } catch {
      setProcessed(new Map())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const reflectedCount = memos.filter((m) => {
    const rec = processed.get(m.path)
    return rec && rec.action !== 'discard'
  }).length
  const pendingCount = memos.length - reflectedCount

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Scrollable content */}
      <div
        className="relative z-[1] flex-1 overflow-auto"
        style={{ paddingTop: 'calc(56px + var(--sai-top, 0px))', paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        {/* Header */}
        <div className="flex items-baseline justify-between px-5 pb-4 pt-3.5">
          <div className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>
            보낸 메모
          </div>
          {!loading && memos.length > 0 && (
            <div className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {pendingCount > 0 ? `미처리 ${pendingCount}` : '모두 반영됨'}
            </div>
          )}
        </div>

        <div className="px-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[52px] rounded-2xl" style={{ background: 'var(--color-skel)' }} />
              ))}
            </div>
          ) : memos.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed p-[22px_18px]"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border-strong)' }}
            >
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                아직 보낸 메모가 없습니다
              </div>
              <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                하단 FAB으로 메모·회의·할일을 inbox에 보내면 여기에서 처리 상태를 확인할 수 있습니다.
              </div>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-2xl border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--glass-shadow)' }}
            >
              {memos.map((m, i) => (
                <SentRow
                  key={m.path}
                  memo={m}
                  rec={processed.get(m.path)}
                  last={i === memos.length - 1}
                  onOpenDate={onOpenDate}
                />
              ))}
            </div>
          )}
        </div>
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
        {TAB_ITEMS.map((t) => {
          const on = t.key === 'inbox'
          return (
            <button
              key={t.key}
              onClick={() => onTabSelect(t.key)}
              className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent"
              style={{ color: on ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
            >
              {on && (
                <span className="absolute top-1.5 h-1 w-1 rounded-full" style={{ background: 'var(--color-accent)' }} />
              )}
              <Icon name={t.icon} size={22} sw={on ? 2.1 : 1.85} />
              <div className="text-[10px]" style={{ fontWeight: on ? 700 : 500 }}>
                {t.label}
              </div>
            </button>
          )
        })}
      </LiquidGlassSurface>
    </div>
  )
}
