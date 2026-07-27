import { GitHubClient } from '@/services/GitHubClient'
import { SentMemoStore } from '@/services/SentMemoStore'
import type { InboxPath, PutResult } from '@/types'

/** Slate-expressive memo kinds (inbox schema v2, §3.3). */
export type MemoKind = 'memo' | 'meeting' | 'task' | 'append'

export interface MemoInput {
  text: string
  kind: MemoKind
  /** Required for meeting/task; optional for memo. */
  title?: string
  /** Journal date this slate belongs to (YYYY-MM-DD). Default: KST today. */
  targetDate?: string
  /** Meeting attendees (kind=meeting only). */
  attendees?: string[]
  /** Existing slate reference — id or title (kind=append only). */
  targetSlateRef?: string
  tags?: string[]
}

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

/** KST date parts for the given instant (default: now). */
function kstParts(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return {
    y: kst.getUTCFullYear(),
    mo: String(kst.getUTCMonth() + 1).padStart(2, '0'),
    d: String(kst.getUTCDate()).padStart(2, '0'),
    h: String(kst.getUTCHours()).padStart(2, '0'),
    mi: String(kst.getUTCMinutes()).padStart(2, '0'),
    s: String(kst.getUTCSeconds()).padStart(2, '0'),
  }
}

/** Format current time as KST ISO string. */
function kstTimestamp(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().replace('Z', '+09:00')
}

/** Today in KST as YYYY-MM-DD. */
function kstToday(): string {
  const { y, mo, d } = kstParts()
  return `${y}-${mo}-${d}`
}

/** inbox/YYYY/MM/DD-HHMMSS-{kind}-{slug}.md */
function generatePath(kind: MemoKind, slug: string): InboxPath {
  const { y, mo, d, h, mi, s } = kstParts()
  return `inbox/${y}/${mo}/${d}-${h}${mi}${s}-${kind}-${slug}.md` as InboxPath
}

/** Detect device string from user agent. */
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

/** YAML-escape a scalar that may contain special characters. */
function yamlScalar(value: string): string {
  if (/^[\w가-힣 .\-/:()]+$/.test(value)) return value
  return `"${value.replace(/"/g, '\\"')}"`
}

/** Build schema-v2 frontmatter + body. */
function buildMarkdownV2(input: MemoInput): string {
  const device = detectDevice()
  const tags = input.tags && input.tags.length > 0 ? input.tags : ['mobile']
  const targetDate = input.targetDate ?? kstToday()

  const lines = [
    '---',
    'source: mobile',
    'schema: 2',
    `created_at: ${kstTimestamp()}`,
    `device: ${device}`,
    `kind: ${input.kind}`,
  ]
  if (input.title) lines.push(`title: ${yamlScalar(input.title)}`)
  lines.push(`target_date: ${targetDate}`)
  if (input.kind === 'meeting' && input.attendees && input.attendees.length > 0) {
    lines.push(`attendees: [${input.attendees.map(yamlScalar).join(', ')}]`)
  }
  if (input.kind === 'append' && input.targetSlateRef) {
    lines.push(`target_slate_id: ${yamlScalar(input.targetSlateRef)}`)
  }
  lines.push(`tags: [${tags.map(yamlScalar).join(', ')}]`)
  lines.push('---', '', input.text.trim(), '')

  return lines.join('\n')
}

export interface SubmitResult {
  success: true
  path: string
  commitSha: string
  kind: MemoKind
  title: string
  targetDate: string
}

/**
 * InboxWriter — writes memos/slates to inbox/ in the worklog_log repo.
 * Emits schema v2 frontmatter (backward compatible: a reader missing `kind`
 * treats the file as a v1 quick-memo).
 */
export const InboxWriter = {
  /** Submit a rich memo (schema v2). Records it locally for the Sent view. */
  async submitMemo(input: MemoInput): Promise<SubmitResult> {
    if (!input.text.trim()) {
      throw new Error('메모 내용이 비어있습니다.')
    }

    const title = input.title?.trim() || input.text.split('\n')[0].trim().slice(0, 40)
    const slug = makeSlug(title || input.text)
    const path = generatePath(input.kind, slug)
    const targetDate = input.targetDate ?? kstToday()
    const content = buildMarkdownV2({ ...input, title: input.title, targetDate })

    const result: PutResult = await GitHubClient.putContents(
      path,
      content,
      `mobile-inbox: ${input.kind}/${slug}`,
    )

    const submit: SubmitResult = {
      success: true,
      path: result.content.path,
      commitSha: result.commit.sha,
      kind: input.kind,
      title,
      targetDate,
    }

    SentMemoStore.add({
      path: submit.path,
      kind: submit.kind,
      title: submit.title,
      targetDate: submit.targetDate,
      commitSha: submit.commitSha,
      createdAt: new Date().toISOString(),
    })

    return submit
  },

  /** Legacy quick-memo entry point (kind=memo). */
  async submit(text: string, tags: string[] = []): Promise<SubmitResult> {
    return this.submitMemo({ text, kind: 'memo', tags })
  },
} as const
