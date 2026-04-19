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

  /** Validate PAT by calling GET /user. Returns user info or throws. */
  async validate(pat: string): Promise<GitHubUser> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    })

    if (!res.ok) {
      if (res.status === 401) throw new Error('PAT이 유효하지 않습니다. 토큰을 확인해주세요.')
      throw new Error(`GitHub API 오류 (${res.status}). 네트워크 연결을 확인해주세요.`)
    }

    return res.json() as Promise<GitHubUser>
  },
} as const
