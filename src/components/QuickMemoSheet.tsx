import { useState, useRef, useEffect, useCallback } from 'react'

import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import { InboxWriter } from '@/services/InboxWriter'
import type { MemoKind } from '@/services/InboxWriter'

// ─── Types ──────────────────────────────────────────────────────────────

interface QuickMemoSheetProps {
  open: boolean
  onClose: () => void
}

type SheetState = 'editing' | 'sending' | 'success' | 'error'

const KIND_CHIPS: { key: MemoKind; label: string }[] = [
  { key: 'memo', label: '메모' },
  { key: 'meeting', label: '회의' },
  { key: 'task', label: '할일' },
  { key: 'append', label: '이어쓰기' },
]

/** Today (KST) as YYYY-MM-DD, for the target-date default. */
function kstTodayStr(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
}

// ─── Web Speech API type declarations ───────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getSpeechRecognition(): SpeechRecognition | null {
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
  if (!SR) return null
  const recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'ko-KR'
  return recognition
}

// ─── QuickMemoSheet ─────────────────────────────────────────────────────

export function QuickMemoSheet({ open, onClose }: QuickMemoSheetProps) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState<MemoKind>('memo')
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState(kstTodayStr)
  const [attendees, setAttendees] = useState('')
  const [slateRef, setSlateRef] = useState('')
  const [state, setState] = useState<SheetState>('editing')
  const [errorMsg, setErrorMsg] = useState('')
  const [listening, setListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Focus textarea when opened
  useEffect(() => {
    if (open) {
      setState('editing')
      setKind('memo')
      setTitle('')
      setTargetDate(kstTodayStr())
      setAttendees('')
      setSlateRef('')
      setTimeout(() => textareaRef.current?.focus(), 100)
    } else {
      // Stop recognition when sheet closes
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
        setListening(false)
      }
    }
  }, [open])

  const handleSend = useCallback(async () => {
    if (!text.trim() || state === 'sending') return

    // Per-kind required fields.
    if ((kind === 'meeting' || kind === 'task') && !title.trim()) {
      setState('error')
      setErrorMsg(kind === 'meeting' ? '회의 제목을 입력하세요.' : '할일 제목을 입력하세요.')
      return
    }
    if (kind === 'append' && !slateRef.trim()) {
      setState('error')
      setErrorMsg('이어쓸 대상 슬레이트를 입력하세요.')
      return
    }

    setState('sending')
    setErrorMsg('')

    try {
      await InboxWriter.submitMemo({
        text,
        kind,
        title: kind === 'memo' ? undefined : title.trim() || undefined,
        targetDate: kind === 'memo' ? undefined : targetDate,
        attendees: kind === 'meeting'
          ? attendees.split(',').map((a) => a.trim()).filter(Boolean)
          : undefined,
        targetSlateRef: kind === 'append' ? slateRef.trim() : undefined,
      })
      setState('success')
      setTimeout(() => {
        setText('')
        setState('editing')
        onClose()
      }, 1200)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : '전송에 실패했습니다.')
    }
  }, [text, kind, title, targetDate, attendees, slateRef, state, onClose])

  const handleClose = useCallback(() => {
    if (state === 'sending') return
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setListening(false)
    }
    setText('')
    setKind('memo')
    setTitle('')
    setAttendees('')
    setSlateRef('')
    setState('editing')
    setErrorMsg('')
    onClose()
  }, [state, onClose])

  // ─── Voice dictation ──────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
      setListening(false)
      return
    }

    const recognition = getSpeechRecognition()
    if (!recognition) {
      setErrorMsg('이 브라우저에서 음성 인식을 지원하지 않습니다.')
      setState('error')
      return
    }

    recognitionRef.current = recognition

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      // Check if last result is final
      const lastResult = event.results[event.results.length - 1]
      if (lastResult.isFinal) {
        setText((prev) => prev + (prev && !prev.endsWith('\n') && !prev.endsWith(' ') ? ' ' : '') + transcript)
      }
    }

    recognition.onerror = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognition.start()
    setListening(true)
  }, [listening])

  // ─── Camera capture ───────────────────────────────────────────────

  const handleCameraTap = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // For now, append a note about the attached image
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    setText((prev) =>
      prev + (prev ? '\n\n' : '') + `📷 사진 첨부 (${timestamp}) — ${file.name}`
    )

    // Reset input for re-capture
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }, [])

  if (!open) return null

  const requiredOk =
    (kind !== 'meeting' && kind !== 'task' ? true : title.trim().length > 0) &&
    (kind !== 'append' ? true : slateRef.trim().length > 0)
  const canSend = text.trim().length > 0 && requiredOk && state === 'editing'
  const hasSpeechAPI = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  const expanded = kind !== 'memo'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
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
            {/* Type chips */}
            <div className="mb-3 flex items-center gap-1.5">
              {KIND_CHIPS.map((chip) => {
                const on = chip.key === kind
                return (
                  <button
                    key={chip.key}
                    onClick={() => setKind(chip.key)}
                    className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: on ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: on ? 'var(--color-accent-text-on)' : 'var(--color-text-sec)',
                      borderColor: on ? 'var(--color-accent)' : 'var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>

            {/* Expanded fields for non-memo kinds */}
            {expanded && (
              <div className="mb-3 flex flex-col gap-2">
                {kind === 'append' ? (
                  <input
                    value={slateRef}
                    onChange={(e) => setSlateRef(e.target.value)}
                    placeholder="이어쓸 대상 슬레이트 (제목 또는 id)"
                    className="rounded-xl border px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                ) : (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === 'meeting' ? '회의 제목' : '할일 제목'}
                    className="rounded-xl border px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <label className="flex-shrink-0 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                    귀속 날짜
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                </div>
                {kind === 'meeting' && (
                  <input
                    value={attendees}
                    onChange={(e) => setAttendees(e.target.value)}
                    placeholder="참석자 (쉼표로 구분, 선택)"
                    className="rounded-xl border px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  />
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="메모를 입력하세요...&#10;&#10;Markdown을 지원합니다."
              disabled={state === 'sending'}
              className="flex-1 resize-none rounded-2xl border p-4 text-sm leading-relaxed outline-none"
              style={{
                background: 'var(--color-surface)',
                borderColor: listening ? 'var(--color-accent)' : 'var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                opacity: state === 'sending' ? 0.5 : 1,
                boxShadow: listening ? '0 0 0 2px var(--color-accent-soft)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
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

            {/* Toolbar */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Mic button */}
                {hasSpeechAPI && (
                  <button
                    onClick={toggleVoice}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-none"
                    style={{
                      background: listening ? 'var(--color-accent)' : 'var(--color-surface)',
                      color: listening ? 'var(--color-accent-text-on)' : 'var(--color-text-sec)',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <Icon
                      name="mic"
                      size={18}
                      color={listening ? 'var(--color-accent-text-on)' : 'var(--color-text-sec)'}
                      sw={2}
                    />
                  </button>
                )}

                {/* Camera button */}
                <button
                  onClick={handleCameraTap}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border-none"
                  style={{
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-sec)',
                    cursor: 'pointer',
                  }}
                >
                  <Icon name="camera" size={18} color="var(--color-text-sec)" sw={2} />
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />

                {listening && (
                  <span
                    className="ml-1 text-[11px] font-semibold"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    듣는 중...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="font-mono text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                  inbox/
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
