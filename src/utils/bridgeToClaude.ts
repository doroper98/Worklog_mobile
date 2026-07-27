import type { BridgeResult } from '@/types'

const CLAUDE_APP_URL = 'https://claude.ai/new'

/**
 * Hand text off to Claude. Uses the native share sheet when available
 * (so the user can pick the Claude app), otherwise copies to the clipboard
 * and returns the Claude URL for a manual paste.
 */
export async function bridgeToClaude(text: string): Promise<BridgeResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return { kind: 'native-share', shared: true }
    } catch {
      // User cancelled or share failed — fall through to clipboard.
    }
  }

  try {
    await navigator.clipboard?.writeText(text)
  } catch {
    // Clipboard may be unavailable; the caller still gets the URL to open.
  }
  return { kind: 'clipboard-fallback', copiedText: text, claudeAppUrl: CLAUDE_APP_URL }
}
