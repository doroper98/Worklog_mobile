/** Allowed theme settings */
export type ThemeSetting = 'light' | 'dark' | 'system'

/** Resolved effective theme (never 'system') */
export type EffectiveTheme = 'light' | 'dark'

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
