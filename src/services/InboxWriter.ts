import { GitHubClient } from '@/services/GitHubClient'
import type { InboxPath, PutResult } from '@/types'

/**
 * Generate a slug from the first line of text.
 * Strips markdown, truncates to ~30 chars, replaces spaces with hyphens.
 */
function makeSlug(text: string): string {
  const firstLine = text.split('\n')[0].trim()
  const cleaned = firstLine
    .replace(/^#+\s*/, '')     // strip heading markers
    .replace(/[^\w\s가-힣-]/g, '') // keep word chars, Korean, spaces, hyphens
    .trim()
    .slice(0, 30)
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

  return cleaned || 'memo'
}

/**
 * Format current time as KST ISO string.
 */
function kstTimestamp(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace('Z', '+09:00')
}

/**
 * Generate inbox file path: inbox/YYYY/MM/DD-HHMMSS-slug.md
 */
function generatePath(slug: string): InboxPath {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const mi = String(kst.getUTCMinutes()).padStart(2, '0')
  const s = String(kst.getUTCSeconds()).padStart(2, '0')

  return `inbox/${y}/${mo}/${d}-${h}${mi}${s}-${slug}.md` as InboxPath
}

/**
 * Build markdown content with frontmatter.
 */
function buildMarkdown(text: string, tags: string[]): string {
  const device = detectDevice()
  const tagList = tags.length > 0 ? `[${tags.join(', ')}]` : '[quick-memo]'

  return `---
source: mobile
created_at: ${kstTimestamp()}
device: ${device}
tags: ${tagList}
---

${text.trim()}
`
}

/**
 * Detect device string from user agent.
 */
function detectDevice(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone OS (\d+_\d+)/)
    return match ? `iPhone (iOS ${match[1].replace('_', '.')})` : 'iPhone (Safari)'
  }
  if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/)
    return match ? `Android ${match[1]} (Chrome)` : 'Android (Chrome)'
  }
  return 'Browser'
}

export interface SubmitResult {
  success: true
  path: string
  commitSha: string
}

/**
 * InboxWriter — writes quick memos to inbox/ in the worklog_log repo.
 * Generates frontmatter, slug-based filename, and commits via GitHub API.
 */
export const InboxWriter = {
  /**
   * Submit a quick memo to the inbox.
   * Returns the committed file path and SHA.
   */
  async submit(text: string, tags: string[] = []): Promise<SubmitResult> {
    if (!text.trim()) {
      throw new Error('메모 내용이 비어있습니다.')
    }

    const slug = makeSlug(text)
    const path = generatePath(slug)
    const content = buildMarkdown(text, tags)

    const result: PutResult = await GitHubClient.putContents(
      path,
      content,
      `mobile-inbox: ${slug}`,
    )

    return {
      success: true,
      path: result.content.path,
      commitSha: result.commit.sha,
    }
  },
} as const
