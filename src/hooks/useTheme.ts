import { useState, useEffect, useMemo, useCallback } from 'react'

import type { ThemeSetting, EffectiveTheme } from '@/types'

const STORAGE_KEY = 'theme'

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): ThemeSetting {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function useTheme() {
  const [setting, setSetting] = useState<ThemeSetting>(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme)

  const effectiveTheme: EffectiveTheme = useMemo(
    () => (setting === 'system' ? systemTheme : setting),
    [setting, systemTheme],
  )

  // Listen to OS theme changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Apply data-theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  const setTheme = useCallback((next: ThemeSetting) => {
    setSetting(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return { setting, effectiveTheme, setTheme } as const
}
