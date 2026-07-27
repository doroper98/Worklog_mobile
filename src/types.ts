import type { ThemeKey } from '@/styles/palettes'

/**
 * Allowed theme settings. 'system' follows the OS; 'light'/'dark' pin the base
 * themes; a ThemeKey pins one of the ported desktop themes (§4.6-4). Kept as a
 * flat union (not { mode, theme }) for backward-compat with the existing
 * localStorage['theme'] single-string value.
 */
export type ThemeSetting = 'light' | 'dark' | 'system' | ThemeKey

/** Resolved effective theme applied to <html data-theme> (never 'system') */
export type EffectiveTheme = 'light' | 'dark' | ThemeKey

/** Glass performance tier set by deviceCapabilities */
export type GlassPerf = 'full' | 'low' | 'none'

/** GitHub PAT-gated path for inbox writes */
export type InboxPath = `inbox/${string}`

/** GitHub file content from Contents API */
export interface FileContent {
  name: string
  path: string
  sha: string
  content: string
  encoding: string
}

/** GitHub directory entry from Contents API */
export interface DirEntry {
  name: string
  path: string
  sha: string
  type: 'file' | 'dir' | 'symlink'
  size?: number
}

/** GitHub tree node */
export interface TreeNode {
  path: string
  mode: string
  type: 'blob' | 'tree'
  sha: string
  size?: number
}

/** Put result from Contents API */
export interface PutResult {
  content: { sha: string; path: string }
  commit: { sha: string; message: string }
}

/** Rate limit info */
export interface RateLimit {
  limit: number
  remaining: number
  reset: number
}

/** Slate category kind */
export type SlateKind = 'meeting' | 'task' | 'memo' | 'personal'

/** Bridge to Claude result */
export type BridgeResult =
  | { kind: 'native-share'; shared: true }
  | { kind: 'clipboard-fallback'; copiedText: string; claudeAppUrl: string }
