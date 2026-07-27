import palettesData from '@/styles/palettes.json'

/** Keys of the ported (fixed) desktop themes. */
export type ThemeKey =
  | 'cyprus'
  | 'noturno'
  | 'bridal'
  | 'cosmos'
  | 'laurel'
  | 'princess'
  | 'steel'
  | 'navy'

export interface Palette {
  key: ThemeKey
  label: string
  mode: 'light' | 'dark'
  primary: string
  bg: string
  bg2: string
  surface: string
  text: string
}

/**
 * Ordered list of ported palettes. Single source shared with
 * scripts/gen-themes.mjs (which reads palettes.json directly) so the CSS in
 * themes-extra.css and the Settings swatches never drift apart.
 */
export const PALETTES = palettesData.palettes as Palette[]

export const THEME_KEYS = PALETTES.map((p) => p.key)

export function isThemeKey(value: string): value is ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey)
}

export function paletteFor(key: ThemeKey): Palette | undefined {
  return PALETTES.find((p) => p.key === key)
}
