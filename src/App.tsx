import { useState, useEffect, useCallback } from 'react'

import { ThemeProvider } from '@/components/primitives/ThemeProvider'
import { AuthGate } from '@/components/AuthGate'
import { HomeView } from '@/components/HomeView'
import { WikiCategory } from '@/components/WikiCategory'
import { CalendarView } from '@/components/CalendarView'
import { MarkdownView } from '@/components/MarkdownView'
import { SearchView } from '@/components/SearchView'
import { QuickMemoSheet } from '@/components/QuickMemoSheet'
import { SettingsView } from '@/components/SettingsView'
import { AuthManager } from '@/services/AuthManager'
import type { GitHubUser } from '@/services/AuthManager'
import { useWikiTree } from '@/hooks/useWikiTree'
import { useDocument } from '@/hooks/useDocument'
import { useTodayFiles } from '@/hooks/useTodayFiles'
import { useRecentDocs } from '@/hooks/useRecentDocs'
import { useOnline } from '@/hooks/useOnline'

// ─── View state ─────────────────────────────────────────────────────────

type ViewState =
  | { view: 'home' }
  | { view: 'calendar' }
  | { view: 'search' }
  | { view: 'settings' }
  | { view: 'category'; key: string }
  | { view: 'document'; path: string; from: 'home' | 'category' | 'calendar' | 'search' }

// ─── Authenticated shell ────────────────────────────────────────────────

function AuthenticatedShell({ onLogout }: { onLogout: () => void }) {
  const [viewState, setViewState] = useState<ViewState>({ view: 'home' })
  const [memoOpen, setMemoOpen] = useState(false)
  const { categories, loading: treeLoading } = useWikiTree()
  const { document, loading: docLoading, loadDocument, clearDocument } = useDocument()
  const { slates: todaySlates, daysWithFiles, selectedDate, selectDate, loading: todayLoading } = useTodayFiles()
  const { recentDocs, recordAccess } = useRecentDocs()
  const online = useOnline()

  const handleCategoryTap = useCallback((key: string) => {
    setViewState({ view: 'category', key })
  }, [])

  const handleFileTap = useCallback((path: string) => {
    const from = viewState.view === 'calendar' ? 'calendar' as const
      : viewState.view === 'category' ? 'category' as const
      : viewState.view === 'search' ? 'search' as const
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
      } else if (viewState.from === 'search') {
        setViewState({ view: 'search' })
      } else {
        setViewState({ view: 'home' })
      }
    } else {
      setViewState({ view: 'home' })
    }
  }, [viewState, clearDocument])

  const handleTabSelect = useCallback((tab: string) => {
    clearDocument()
    if (tab === 'calendar') {
      setViewState({ view: 'calendar' })
    } else if (tab === 'settings') {
      setViewState({ view: 'settings' })
    } else {
      setViewState({ view: 'home' })
    }
  }, [clearDocument])

  const handleSearchTap = useCallback(() => {
    setViewState({ view: 'search' })
  }, [])

  const handleFabTap = useCallback(() => {
    setMemoOpen(true)
  }, [])

  const handleMemoClose = useCallback(() => {
    setMemoOpen(false)
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
      <>
        <CalendarView
          onTabSelect={handleTabSelect}
          onFileTap={handleFileTap}
          onFabTap={handleFabTap}
        />
        <QuickMemoSheet open={memoOpen} onClose={handleMemoClose} />
      </>
    )
  }

  if (viewState.view === 'search') {
    return (
      <SearchView
        onFileTap={handleFileTap}
        onBack={handleBack}
      />
    )
  }

  if (viewState.view === 'settings') {
    return (
      <SettingsView
        onTabSelect={handleTabSelect}
        onLogout={onLogout}
      />
    )
  }

  return (
    <>
      <HomeView
        categories={categories}
        loading={treeLoading}
        selectedDate={selectedDate}
        todaySlates={todaySlates}
        todayLoading={todayLoading}
        daysWithFiles={daysWithFiles}
        onSelectDate={selectDate}
        recentDocs={recentDocs}
        offline={!online}
        onCategoryTap={handleCategoryTap}
        onFileTap={handleFileTap}
        onSearchTap={handleSearchTap}
        onTabSelect={handleTabSelect}
        onFabTap={handleFabTap}
      />
      <QuickMemoSheet open={memoOpen} onClose={handleMemoClose} />
    </>
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

  return <AuthenticatedShell onLogout={() => setUser(null)} />
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  )
}
