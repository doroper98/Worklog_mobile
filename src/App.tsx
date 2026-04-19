import { useState, useEffect, useCallback } from 'react'

import { ThemeProvider, useThemeContext } from '@/components/primitives/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { AuthManager } from '@/services/AuthManager'
import type { GitHubUser } from '@/services/AuthManager'

function AuthenticatedShell({ user }: { user: GitHubUser }) {
  const { effectiveTheme } = useThemeContext()

  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Radial wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(120% 60% at 50% 0%, var(--color-accent-soft), transparent 60%)',
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1
          className="font-display text-2xl font-bold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          Workwiki Mobile
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {user.login} · {effectiveTheme} · M2 scaffold
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
          M3에서 HomeView·TreeNav·MarkdownView를 구현합니다.
        </p>
      </div>
    </div>
  )
}

function AppShell() {
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [checking, setChecking] = useState(true)

  // Auto-validate stored PAT on mount
  useEffect(() => {
    const pat = AuthManager.getPat()
    if (!pat) {
      setChecking(false)
      return
    }

    AuthManager.validate(pat)
      .then(setUser)
      .catch(() => {
        AuthManager.clearPat()
      })
      .finally(() => setChecking(false))
  }, [])

  const handleAuthenticated = useCallback((u: GitHubUser) => {
    setUser(u)
  }, [])

  if (checking) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="font-mono text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          인증 확인 중...
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />
  }

  return <AuthenticatedShell user={user} />
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
