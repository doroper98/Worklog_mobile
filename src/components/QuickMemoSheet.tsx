import { useState, useRef, useEffect, useCallback } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { InboxWriter } from '@/services/InboxWriter'

// ─── Types ──────────────────────────────────────────────────────────────

interface QuickMemoSheetProps {
  open: boolean
  onClose: () => void
}

type SheetState = 'editing' | 'sending' | 'success' | 'error'

// ─── QuickMemoSheet ─────────────────────────────────────────────────────

export function QuickMemoSheet({ open, onClose }: QuickMemoSheetProps) {
  const [text, setText] = useState('')
  const [state, setState] = useState<SheetState>('editing')
  const [errorMsg, setErrorMsg] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setState('editing')
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  const handleSend = useCallback(async () => {
    if (!text.trim() || state === 'sending') return

    setState('sending')
    setErrorMsg('')

    try {
      await InboxWriter.submit(text)
      setState('success')
      // Auto-close after success
      setTimeout(() => {
        setText('')
        setState('editing')
        onClose()
      }, 1200)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : '전송에 실패했습니다.')
    }
  }, [text, state, onClose])

  const handleClose = useCallback(() => {
    if (state === 'sending') return
    setText('')
    setState('editing')
    setErrorMsg('')
    onClose()
  }, [state, onClose])

  if (!open) return null

  const canSend = text.trim().length > 0 && state === 'editing'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Scrim overlay for closing */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(120% 50% at 50% 0%, var(--color-accent-soft), transparent 60%)',
        }}
      />

      {/* Header */}
      <LiquidGlassSurface level={1} className="relative z-10 px-4 pb-3 pt-16">
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            className="flex h-8 items-center gap-1 rounded-[10px] border-none bg-transparent px-1"
            style={{ color: 'var(--color-accent)' }}
          >
            <Icon name="x" size={20} sw={2.2} />
            <span className="text-sm font-semibold">닫기</span>
          </button>
          <div
            className="font-display text-base font-bold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            빠른 메모
          </div>
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-8 items-center gap-1 rounded-full border-none px-3 py-1"
            style={{
              background: canSend ? 'var(--color-accent)' : 'var(--color-surface-alt)',
              color: canSend ? 'var(--color-accent-text-on)' : 'var(--color-text-muted)',
              cursor: canSend ? 'pointer' : 'default',
              opacity: canSend ? 1 : 0.5,
            }}
          >
            {state === 'sending' ? (
              <span className="text-sm font-semibold">전송 중...</span>
            ) : (
              <>
                <Icon
                  name="arrow-up"
                  size={14}
                  color={canSend ? 'var(--color-accent-text-on)' : 'var(--color-text-muted)'}
                  sw={2.5}
                />
                <span className="text-sm font-semibold">전송</span>
              </>
            )}
          </button>
        </div>
      </LiquidGlassSurface>

      {/* Body */}
      <div className="relative z-[1] flex flex-1 flex-col px-5 py-4">
        {state === 'success' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'var(--color-accent-soft)' }}
            >
              <Icon name="check" size={28} color="var(--color-accent)" sw={2.5} />
            </div>
            <div className="text-center">
              <div className="text-base font-bold" style={{ color: 'var(--color-text)' }}>
                메모가 전송되었습니다
              </div>
              <div className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                inbox에 저장됨
              </div>
            </div>
          </div>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메모를 입력하세요...&#10;&#10;Markdown을 지원합니다."
              disabled={state === 'sending'}
              className="flex-1 resize-none rounded-2xl border p-4 text-sm leading-relaxed outline-none"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                opacity: state === 'sending' ? 0.5 : 1,
              }}
            />

            {/* Error message */}
            {state === 'error' && errorMsg && (
              <div
                className="mt-3 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                  color: 'var(--color-danger)',
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Footer info */}
            <div className="mt-3 flex items-center justify-between">
              <div className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                inbox/ 에 커밋됩니다
              </div>
              <div
                className="font-mono text-[10px]"
                style={{
                  color: text.length > 5000 ? 'var(--color-danger)' : 'var(--color-text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {text.length}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
