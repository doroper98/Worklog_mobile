import { DATA_REPO } from '@/utils/constants'

const PAT_KEY = 'gh_pat'

export interface GitHubUser {
  login: string
  avatar_url: string
  name: string | null
}

/**
 * Manage GitHub PAT lifecycle.
 * Storage: localStorage only (per ADR-005, CLAUDE.md §6.1).
 */
export const AuthManager = {
  getPat(): string | null {
    return localStorage.getItem(PAT_KEY)
  },

  setPat(pat: string): void {
    localStorage.setItem(PAT_KEY, pat)
  },

  clearPat(): void {
    localStorage.removeItem(PAT_KEY)
  },

  hasPat(): boolean {
    return !!localStorage.getItem(PAT_KEY)
  },

  /**
   * Validate PAT: identity (GET /user) AND data-repo access (GET /repos/…).
   * A fine-grained PAT scoped to the wrong repository passes /user but cannot
   * read the data repo — every screen then silently loads empty. Rejecting it
   * here surfaces the mis-scope at login time instead.
   */
  async validate(pat: string): Promise<GitHubUser> {
    const headers = {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    }

    const res = await fetch('https://api.github.com/user', { headers })
    if (!res.ok) {
      if (res.status === 401) throw new Error('PAT이 유효하지 않습니다. 토큰을 확인해주세요.')
      throw new Error(`GitHub API 오류 (${res.status}). 네트워크 연결을 확인해주세요.`)
    }
    const user = (await res.json()) as GitHubUser

    const repoRes = await fetch(`https://api.github.com/repos/${DATA_REPO}`, { headers })
    if (!repoRes.ok) {
      // Fine-grained PAT without access to a private repo returns 404.
      if (repoRes.status === 404 || repoRes.status === 403) {
        throw new Error(
          `데이터 저장소(${DATA_REPO})에 접근할 수 없는 토큰입니다. ` +
          'Fine-grained PAT의 Repository access에 데이터 저장소를 포함하고 Contents 권한(Read and write)을 부여해주세요.',
        )
      }
      throw new Error(`데이터 저장소 확인 실패 (${repoRes.status}). 네트워크 연결을 확인해주세요.`)
    }

    return user
  },
} as const
