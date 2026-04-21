import { useState, useCallback } from 'react'

import { AuthManager } from '@/services/AuthManager'
import type { GitHubUser } from '@/services/AuthManager'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'

interface AuthGateProps {
  onAuthenticated: (user: GitHubUser) => void
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [pat, setPat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = pat.trim()
      if (!trimmed) return

      setError(null)
      setLoading(true)

      try {
        const user = await AuthManager.validate(trimmed)
        AuthManager.setPat(trimmed)
        onAuthenticated(user)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PAT 검증에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    },
    [pat, onAuthenticated],
  )

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center px-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-accent)', boxShadow: '0 4px 16px var(--color-accent-faint)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M4.5 4.5h11.5l3.5 3.5v11.5H7.5L4.5 16.5v-12z"
                stroke="#fff" strokeWidth={1.9} strokeLinejoin="round"
              />
              <path
                d="M9 10l1.4 4.8L12 12l1.6 2.8L15 10"
                stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            Workwiki Mobile
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            GitHub Personal Access Token을 입력해주세요.
          </p>
        </div>

        {/* Form */}
        <LiquidGlassSurface level={1} className="rounded-3xl p-5">
          <form onSubmit={handleSubmit}>
            <label
              className="mb-2 block text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
              htmlFor="pat-input"
            >
              GitHub PAT
            </label>
            <input
              id="pat-input"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
              spellCheck={false}
              className="mb-3 w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none transition-colors"
              style={{
                background: 'var(--color-surface)',
                borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
                color: 'var(--color-text)',
              }}
              disabled={loading}
            />

            {error && (
              <p className="mb-3 text-xs font-medium" style={{ color: 'var(--color-danger)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !pat.trim()}
              className="w-full rounded-xl py-3 text-sm font-bold transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text-on)',
                boxShadow: '0 4px 14px var(--color-accent-faint)',
              }}
            >
              {loading ? '검증 중...' : '연결'}
            </button>
          </form>
        </LiquidGlassSurface>

        {/* Help toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-xs font-medium"
            style={{ color: 'var(--color-accent)' }}
          >
            {showHelp ? '접기' : 'PAT이 왜 필요한가요?'}
          </button>

          {showHelp && (
            <div
              className="mt-3 rounded-2xl p-4 text-left text-xs leading-relaxed"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-sec)',
              }}
            >
              <p className="mb-2">
                이 앱은 서버 없이 GitHub API로 직접 데이터를 읽고 씁니다.
                PAT은 이 기기의 localStorage에만 저장되며 외부로 전송되지 않습니다.
              </p>
              <p className="mb-2 font-semibold" style={{ color: 'var(--color-text)' }}>
                필요한 권한:
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>Fine-grained PAT</li>
                <li>Repository: Contents → Read and Write</li>
                <li>나머지 모두 No access</li>
                <li>만료: 90일 권장</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
