import type { MemoKind } from '@/services/InboxWriter'

/** A memo the user sent from this device (persisted locally). */
export interface SentMemo {
  path: string
  kind: MemoKind
  title: string
  targetDate: string
  commitSha: string
  createdAt: string // local ISO of send
}

const STORAGE_KEY = 'sent_memos'
const MAX_ENTRIES = 200

function read(): SentMemo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SentMemo[]) : []
  } catch {
    return []
  }
}

function write(list: SentMemo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch {
    // Storage full / unavailable — non-fatal; the remote commit is the source of truth.
  }
}

/**
 * Local record of memos sent from this device. Lets the Sent view show
 * outgoing memos even offline, before the desktop processes them.
 */
export const SentMemoStore = {
  list(): SentMemo[] {
    // Newest first.
    return read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },

  add(memo: SentMemo): void {
    const list = read().filter((m) => m.path !== memo.path)
    list.unshift(memo)
    write(list)
  },

  clear(): void {
    write([])
  },
}
