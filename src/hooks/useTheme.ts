import { useState, useEffect, useMemo, useCallback } from 'react'

import type { ThemeSetting, EffectiveTheme } from '@/types'
import { isThemeKey } from '@/styles/palettes'

const STORAGE_KEY = 'theme'

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): ThemeSetting {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  if (stored && isThemeKey(stored)) return stored
  return 'system'
}

/**
 * Sync the <meta name="theme-color"> to the active theme's opaque background so
 * the iOS standalone status bar matches the app (§4.6-2). Reads the resolved
 * --bg-opaque token, which every theme defines as a solid color.
 */
function syncThemeColorMeta(): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const bg = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg-opaque')
    .trim()
  if (bg) meta.setAttribute('content', bg)
}

export function useTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme)

  const effectiveTheme: EffectiveTheme = useMemo(
    () => (setting === 'system' ? systemTheme : setting),
    [setting, systemTheme],
  )

  // Listen to OS theme changes (only affects the 'system' setting)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Apply data-theme attribute to <html>, then sync the status-bar color.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    // Defer one frame so the new theme's variables are committed before we read them.
    requestAnimationFrame(syncThemeColorMeta)
  }, [effectiveTheme])

  const setTheme = useCallback((next: ThemeSetting) => {
    setSetting(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return { setting, effectiveTheme, setTheme } as const
}
