import { useState, useEffect, useCallback } from 'react'

import { ThemeProvider } from '@/components/primitives/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { HomeView } from '@/components/HomeView'
import { WikiCategory } from '@/components/WikiCategory'
import { CalendarView } from '@/components/CalendarView'
import { MarkdownView } from '@/components/MarkdownView'
import { AuthManager } from '@/services/AuthManager'
import type { GitHubUser } from '@/services/AuthManager'
import { useWikiTree } from '@/hooks/useWikiTree'
import { useDocument } from '@/hooks/useDocument'
import { useTodayFiles } from '@/hooks/useTodayFiles'
import { useRecentDocs } from '@/hooks/useRecentDocs'

// ─── View state ─────────────────────────────────────────────────────────

type ViewState =
  | { view: 'home' }
  | { view: 'calendar' }
  | { view: 'category'; key: string }
  | { view: 'document'; path: string; from: 'home' | 'category' | 'calendar' }

// ─── Authenticated shell ────────────────────────────────────────────────

function AuthenticatedShell() {
  const [viewState, setViewState] = useState<ViewState>({ view: 'home' })
  const { categories, loading: treeLoading } = useWikiTree()
  const { document, loading: docLoading, loadDocument, clearDocument } = useDocument()
  const { files: todayFiles, daysWithFiles, selectedDate, selectDate, loading: todayLoading } = useTodayFiles()
  const { recentDocs, recordAccess } = useRecentDocs()

  const handleCategoryTap = useCallback((key: string) => {
    setViewState({ view: 'category', key })
  }, [])

  const handleFileTap = useCallback((path: string) => {
    const from = viewState.view === 'calendar' ? 'calendar' as const
      : viewState.view === 'category' ? 'category' as const
      : 'home' as const
    setViewState({ view: 'document', path, from })
    loadDocument(path)
    recordAccess(path)
  }, [loadDocument, recordAccess, viewState.view])

  const handleBack = useCallback(() => {
    clearDocument()
    if (viewState.view === 'document') {
      if (viewState.from === 'calendar') {
        setViewState({ view: 'calendar' })
      } else {
        setViewState({ view: 'home' })
      }
    } else {
      setViewState({ view: 'home' })
    }
  }, [viewState, clearDocument])

  const handleTabSelect = useCallback((tab: string) => {
    if (tab === 'calendar') {
      clearDocument()
      setViewState({ view: 'calendar' })
    } else {
      // M4+ will handle inbox, settings tabs
      clearDocument()
      setViewState({ view: 'home' })
    }
  }, [clearDocument])

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

  if (viewState.view === 'calendar') {
    return (
      <CalendarView
        onTabSelect={handleTabSelect}
        onFileTap={handleFileTap}
      />
    )
  }

  return (
    <HomeView
      categories={categories}
      loading={treeLoading}
      selectedDate={selectedDate}
      todayFiles={todayFiles}
      todayLoading={todayLoading}
      daysWithFiles={daysWithFiles}
      onSelectDate={selectDate}
      recentDocs={recentDocs}
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
