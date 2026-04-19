import type { FileContent, DirEntry, TreeNode, PutResult, RateLimit, InboxPath } from '@/types'
import { AuthManager } from '@/services/AuthManager'

const API = 'https://api.github.com'
const REPO = 'doroper98/worklog_log'

function headers(): HeadersInit {
  const pat = AuthManager.getPat()
  if (!pat) throw new Error('GitHub PAT이 설정되지 않았습니다.')
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}/repos/${REPO}${path}`
  const res = await fetch(url, { ...init, headers: { ...headers(), ...init?.headers } })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json() as Promise<T>
}

/**
 * GitHub REST API client for worklog_log repo.
 * Read any path, write only to inbox/ (enforced by InboxPath type + runtime guard).
 */
export const GitHubClient = {
  /** Get file content or directory listing */
  async getContents(path: string): Promise<FileContent | DirEntry[]> {
    return request(`/contents/${path}`)
  },

  /** Get repo tree (optionally recursive) */
  async getTree(sha = 'HEAD', recursive = false): Promise<TreeNode[]> {
    const suffix = recursive ? '?recursive=1' : ''
    const data = await request<{ tree: TreeNode[] }>(`/git/trees/${sha}${suffix}`)
    return data.tree
  },

  /** Get blob content (base64 decoded) */
  async getBlob(sha: string): Promise<string> {
    const data = await request<{ content: string; encoding: string }>(`/git/blobs/${sha}`)
    if (data.encoding === 'base64') {
      return atob(data.content.replace(/\n/g, ''))
    }
    return data.content
  },

  /** Write file to inbox/ only. Runtime guard enforces path constraint. */
  async putContents(
    path: InboxPath,
    content: string,
    message: string,
    sha?: string,
  ): Promise<PutResult> {
    // Runtime guard (belt + suspenders with InboxPath type)
    if (!path.startsWith('inbox/')) {
      throw new Error(`Write denied: path must start with inbox/, got "${path}"`)
    }

    return request(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        ...(sha ? { sha } : {}),
      }),
    })
  },

  /** Get latest commit SHA for a branch */
  async getLatestCommitSha(branch = 'main'): Promise<string> {
    const data = await request<{ object: { sha: string } }>(`/git/ref/heads/${branch}`)
    return data.object.sha
  },

  /** Get API rate limit info */
  async getRateLimit(): Promise<RateLimit> {
    const data = await request<{ rate: RateLimit }>('/rate_limit')
    return data.rate
  },
} as const
