import { useState, useEffect, useCallback } from 'react'

import { registerSW } from 'virtual:pwa-register'

/** Re-check for a new service worker this often while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

export interface AppUpdateState {
  /** A new build is installed and waiting; show the banner. */
  needRefresh: boolean
  /** The user tapped "업데이트"; the page is about to reload. */
  applying: boolean
  /** Activate the waiting worker and reload. */
  apply: () => Promise<void>
  /** Ask the browser to look for a new worker now (pull-to-refresh). */
  checkNow: () => Promise<void>
}

// ─── Module-level singleton ─────────────────────────────────────────────
// registerSW must run once per page. StrictMode mounts effects twice and
// several components may use this hook, so the registration and its
// state live here and the hook only subscribes to them.

type Listener = () => void

let registered = false
let needRefresh = false
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | null = null
const listeners = new Set<Listener>()

function notify(): void {
  for (const l of listeners) l()
}

/**
 * Register the service worker once per page. Called from main.tsx so the
 * worker (and update detection) is live before login, not only on Home.
 */
export function registerAppServiceWorker(): void {
  if (registered) return
  registered = true
  if (!('serviceWorker' in navigator)) return

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      console.info('[pwa] new build installed and waiting')
      needRefresh = true
      notify()
    },
    onRegisteredSW: (_url, r) => {
      registration = r ?? null
    },
    onRegisterError: (err: unknown) => {
      console.error('[pwa] service worker registration failed', err)
    },
  })
}

async function checkForUpdate(): Promise<void> {
  if (!registration || !navigator.onLine) return
  try {
    await registration.update()
  } catch (err) {
    // 오프라인·일시 네트워크 오류. 다음 주기나 포그라운드 복귀 때 다시 시도한다.
    console.warn('[pwa] update check failed', err)
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useAppUpdate(): AppUpdateState {
  const [ready, setReady] = useState(needRefresh)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    registerAppServiceWorker()
    const onChange = () => setReady(needRefresh)
    listeners.add(onChange)
    onChange()

    const interval = window.setInterval(() => { void checkForUpdate() }, CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      listeners.delete(onChange)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const apply = useCallback(async () => {
    if (!updateSW) return
    setApplying(true)
    // Posts SKIP_WAITING to the waiting worker; the page reloads on controllerchange.
    await updateSW(true)
    // If the waiting worker was already activated elsewhere (another tab), no
    // controllerchange reaches this page. Reload anyway so the banner never sticks.
    window.setTimeout(() => window.location.reload(), 4000)
  }, [])

  const checkNow = useCallback(() => checkForUpdate(), [])

  return { needRefresh: ready, applying, apply, checkNow }
}
