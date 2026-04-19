import { createContext, useContext } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { useLiquidGlass } from '@/hooks/useLiquidGlass'
import type { ThemeSetting, EffectiveTheme, GlassPerf } from '@/types'

interface ThemeContextValue {
  setting: ThemeSetting
  effectiveTheme: EffectiveTheme
  setTheme: (next: ThemeSetting) => void
  glassPerf: GlassPerf
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { setting, effectiveTheme, setTheme } = useTheme()
  const glassPerf = useLiquidGlass()

  return (
    <ThemeContext.Provider value={{ setting, effectiveTheme, setTheme, glassPerf }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider')
  return ctx
}
