import { useState, useEffect, useCallback } from 'react'

import { ThemeProvider } from '@/components/primitives/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { HomeView } from '@/components/HomeView'
import { WikiCategory } from '@/components/WikiCategory'
import { MarkdownView } from '@/components/MarkdownView'
import { AuthManager } from '@/services/AuthManager'
import type { GitHubUser } from '@/services/AuthManager'
import { useWikiTree } from '@/hooks/useWikiTree'
import { useDocument } from '@/hooks/useDocument'

// ─── View state ─────────────────────────────────────────────────────────

type ViewState =
  | { view: 'home' }
  | { view: 'category'; key: string }
  | { view: 'document'; path: string }

// ─── Authenticated shell ────────────────────────────────────────────────

function AuthenticatedShell() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'home' })
  const { categories, loading: treeLoading } = useWikiTree()
  const { document, loading: docLoading, loadDocument, clearDocument } = useDocument()

  const handleCategoryTap = useCallback((key: string) => {
    setViewState({ view: 'category', key })
  }, [])

  const handleFileTap = useCallback((path: string) => {
    setViewState({ view: 'document', path })
    loadDocument(path)
  }, [loadDocument])

  const handleBack = useCallback(() => {
    clearDocument()
    if (viewState.view === 'document') {
      // Go back to category if we came from one, otherwise home
      setViewState({ view: 'home' })
    } else {
      setViewState({ view: 'home' })
    }
  }, [viewState.view, clearDocument])

  const handleTabSelect = useCallback((_tab: string) => {
    // M3.5+ will handle calendar, inbox, settings tabs
    setViewState({ view: 'home' })
  }, [])

  const handleSearchTap = useCallback(() => {
    // M5 will implement search
  }, [])

  // Render current view
  if (viewState.view === 'document' && viewState.path) {
    return (
      <MarkdownView
        title={document?.name ?? viewState.path.split('/').pop()?.replace(/\.md$/, '') ?? ''}
        path={viewState.path}
        content={document?.content ?? ''}
        loading={docLoading}
        onBack={handleBack}
      />
    )
  }

  if (viewState.view === 'category') {
    const cat = categories.find((c) => c.key === viewState.key)
    if (cat) {
      return (
        <WikiCategory
          title={cat.title}
          files={cat.files}
          onFileTap={handleFileTap}
          onBack={handleBack}
        />
      )
    }
  }

  return (
    <HomeView
      categories={categories}
      loading={treeLoading}
      onCategoryTap={handleCategoryTap}
      onFileTap={handleFileTap}
      onSearchTap={handleSearchTap}
      onTabSelect={handleTabSelect}
    />
  )
}

// ─── App root ───────────────────────────────────────────────────────────

function AppShell() {
  const [user, setUser] = useState<GitHubUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const pat = AuthManager.getPat()
    if (!pat) {
      setChecking(false)
      return
    }
    AuthManager.validate(pat)
      .then(setUser)
      .catch(() => AuthManager.clearPat())
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
        <div className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
          인증 확인 중...
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />
  }

  return <AuthenticatedShell />
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
