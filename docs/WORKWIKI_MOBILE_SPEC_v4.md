# Workwiki Mobile (PWA) — 구현 명세서 v4

> **문서 용도.** Claude Code가 이 파일 하나만 읽고 Workwiki Mobile 프로젝트를
> 처음부터 끝까지 구현할 수 있도록 작성되었다. 코드 작성 전 §1~§3을 반드시 선독하라.
>
> **작성 기준일.** 2026-04-19
> **변경 이력.**
> - v1: 초안 (길 3.5 = GitHub API 기반 PWA)
> - v2: 저장소 경로 정정 + Phase 5 (자체 CLI-style 채팅) 추가
> - v3: Phase 5 제거 → Phase 5′ (Bridge to claude.ai)로 교체. Phase 6 (Claude Projects 연동) 추가
> - **v4: Cloudflare Pages 배포 채택, 로컬 작업 경로 확정, Claude Design 핸드오프 URL 연결**
>
> **대상 에이전트.** Claude Sonnet 4.6+ / Opus 4.7+
> **선행 지식.** Workwiki v3.16 데스크탑(Electron), Claude Projects, Claude Design 핸드오프 형식

---

## 0. Executive Summary

- 이것은 데스크탑 Workwiki의 **모바일 보조 클라이언트(PWA)**다.
- 네이티브 앱이 아니라 PWA. 앱스토어 배포 없음.
- 서버 없음. **GitHub 저장소가 백엔드**. 채팅 서버도 없음.
- 데이터 저장소 `doroper98/worklog_log`는 이미 존재하며 데스크탑이 push한다는 전제.
- 폰은 그 repo를 GitHub REST API로 **읽기** + `inbox/` 폴더에만 **쓰기**.
- **AI 채팅은 claude.ai에 위임** — Web Share API로 문서를 Claude 앱으로 전달.
- 데스크탑 Workwiki에 **Project Sync** 기능 신설 — worklog_log의 핵심 파일을 Claude Projects용으로 로컬 export.
- **배포는 Cloudflare Pages** — Private repo + 무료 + 한국 저지연.
- **디자인은 Claude Design 핸드오프 번들에서 fetch** — 이 SPEC에는 구체 디자인 값을 담지 않음.

---

## 1. 정체성과 맥락

### 1.1 프로젝트 기본 정보

| 항목 | 값 |
|------|----|
| 프로젝트명 | Workwiki Mobile |
| 코드명 | `workwiki-mobile` |
| 배포 형태 | **PWA (Cloudflare Pages)** |
| 배포 URL | `https://workwiki-mobile.pages.dev` (예정) |
| 타깃 플랫폼 | iOS Safari 16+, Android Chrome 최신 |
| **로컬 작업 경로** | `C:\01_Antigravity\15_work_log_mobile\` |
| **코드 저장소** | `github.com/doroper98/workwiki-mobile` (Private, 신규) |
| **데이터 저장소 (기존)** | `github.com/doroper98/worklog_log` (Private) |
| **참조: 데스크탑 Workwiki 코드** | `github.com/doroper98/Worklog` |
| **디자인 핸드오프 번들** | `https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q` |
| **AI 채팅** | claude.ai 공식 PWA/앱 위임 |
| **Claude Project (신규)** | "Workwiki — 서영균 업무 컨텍스트" |
| 주체자 | 서영균 (doroper98) |

### 1.2 전체 아키텍처

```
┌─────────────────────── 사용자의 폰 홈화면 ───────────────────────┐
│                                                                │
│  ┌──────────────────┐          ┌────────────────────┐          │
│  │ 📝 Workwiki Mobile│          │ 💬 Claude          │          │
│  │ (PWA)             │          │ (공식 PWA/앱)        │          │
│  │ ───────────────── │          │ ──────────────────  │          │
│  │ - 조회·검색        │          │ - Max 구독 자동 적용  │          │
│  │ - 빠른 메모 → inbox│          │ - Projects 맥락 로드 │          │
│  │ - 공유 시트 ───────────────→→ │ - 스트리밍·모델 선택  │          │
│  └─────────┬─────────┘          └──────────┬─────────┘          │
└────────────┼────────────────────────────────┼──────────────────┘
             │                                 │
             │ GitHub REST API                 │ claude.ai 도메인
             ▼                                 ▼
    ┌──────────────────────┐          ┌──────────────────────┐
    │ worklog_log (Private) │          │ Claude Project       │
    │ journals/ markdown/   │          │ "Workwiki 컨텍스트"   │
    │ wiki/ meta-index.json │◄─────────│ - wiki/ 핵심 페이지   │
    │ inbox/ ← 모바일 쓰기  │ 수동      │ - 최근 N개월 markdown│
    └──────────┬───────────┘ 업로드    │ - meta-index.json    │
               ▲                      │ - CLAUDE.md          │
               │                      └──────────────────────┘
               │ git push/pull                    ▲
               │                                  │
    ┌──────────┴──────────────────────────────────┴──────────┐
    │  Desktop Workwiki (Electron, Worklog repo)              │
    │  기존 15개 서비스 + NEW: InboxService + ProjectSync      │
    └────────────────────────────────────────────────────────┘
```

### 1.3 디자인 출처

이 SPEC은 **구체 디자인 값을 담지 않는다**. 색상·타이포·간격·컴포넌트 규칙은 모두 Claude Design 핸드오프 번들에 있다.

**핸드오프 URL:** `https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q`

Claude Code는 작업 시작 시 이 URL을 fetch하여 번들을 받고, README를 먼저 읽은 뒤 내부 HTML·CSS·자산을 참조해 구현한다. 이 번들이 디자인 관련 단일 진실의 출처(single source of truth)다.

SPEC과 핸드오프 번들의 정보가 충돌할 경우 **핸드오프 번들이 우선**한다. 단 SPEC §14 ADR과 §2 GOAL은 건축 원칙이므로 번들이 이것을 덮을 수 없다.

---

## 2. GOAL — 성공 기준

### Phase 1 — 조회 (Read-only)
- **SC-01.** PWA URL 접속 시 GitHub PAT 입력 폼이 뜬다.
- **SC-02.** PAT 입력 후 `wiki/` 하위 마크다운 파일이 트리 뷰로 표시된다.
- **SC-03.** wiki 파일을 탭하면 본문이 마크다운 렌더링되어 보인다.
- **SC-04.** 오늘의 `markdown/YYYY/MM/DD_*.md`가 "오늘의 일지" 섹션에 노출된다.
- **SC-05.** 홈화면 추가 시 standalone 모드로 실행된다.
- **SC-06.** 네트워크 차단 상태에서도 최근 열어본 문서는 SW 캐시로 표시된다.

### Phase 2 — 검색
- **SC-07.** 전문 검색창에서 위키 전체 텍스트 substring 검색이 가능하다.
- **SC-08.** 검색 결과 문서를 열면 검색어가 하이라이트된다.
- **SC-09.** `meta-index.json` 기반 people/projects 패싯 필터가 작동한다.

### Phase 3 — 쓰기 (Inbox Write)
- **SC-10.** 빠른 메모 FAB을 탭하면 입력 모달이 열린다.
- **SC-11.** "전송" 시 `inbox/YYYY/MM/DD-HHMMSS-slug.md`로 private repo에 commit된다.
- **SC-12.** 전송 직후 IndexedDB에도 저장되어 오프라인 열람이 가능하다.
- **SC-13.** Web Speech API 받아쓰기 버튼이 동작한다.
- **SC-14.** 카메라 첨부 시 `inbox/assets/YYYYMMDD-HHMMSS.jpg`가 함께 commit된다.

### Phase 4 — 데스크탑 연동 (Inbox Processing)
- **SC-15.** 데스크탑 Workwiki에 `InboxService`가 신설되어 pull 후 `inbox/`를 스캔한다.
- **SC-16.** `GitPanel`에 "미처리 inbox N건" 배지가 뜬다.
- **SC-17.** 각 inbox 파일에 네 가지 처리 액션이 제공된다.
- **SC-18.** 처리 완료 시 자동 commit이 생성된다.

### Phase 5′ — Bridge to Claude
- **SC-19′.** 각 문서 페이지 하단에 "💬 Claude에 묻기" 버튼이 있다.
- **SC-20′.** 해당 버튼 탭 시 iOS/Android 공유 시트가 호출된다 (Web Share API).
- **SC-21′.** 공유 데이터에 문서 제목, 본문, 위키 경로가 구조화되어 포함된다.
- **SC-22′.** 사용자가 "Claude" 앱을 선택하면 Claude 새 대화 입력창에 내용이 로드된다.
- **SC-23′.** Web Share 미지원 환경에서는 클립보드 복사 + Claude 웹 링크를 제공한다.

### Phase 6 — Claude Projects 연동 (데스크탑 측)
- **SC-24.** 데스크탑 Workwiki에 `ProjectSyncService`가 신설된다.
- **SC-25.** 주 1회(또는 수동 트리거) worklog_log의 핵심 파일을 `~/TCC-data/_project-sync/`로 집계한다.
- **SC-26.** 집계 파일은 `CLAUDE.md` + 카테고리별 병합 파일로 구성된다.
- **SC-27.** 새 `ProjectSyncPanel`에서 export 결과와 업로드 가이드 링크가 노출된다.
- **SC-28.** 실제 Claude Project 업로드는 수동이다.

### Phase 배포 — Cloudflare Pages 연동 ⭐ v4 신규
- **SC-29.** 루트에 `CLOUDFLARE_SETUP.md` 가이드 문서가 존재한다.
- **SC-30.** Vite 기본 빌드 설정으로 `dist/` 출력이 정상 생성된다.
- **SC-31.** Cloudflare Pages에 GitHub 연동 후 자동 빌드·배포가 성공한다.
- **SC-32.** 배포 URL 접속 시 HTTPS로 PWA가 정상 동작한다.

---

## 3. 비목표 (Out of Scope)

- 기존 `journals/*.json`, `markdown/**/*.md`, `wiki/**/*.md`, `meta-index.json`, `log.md`의 **수정**.
- 자체 AI 채팅 UI — claude.ai 위임.
- Anthropic API 직접 호출 — Max 구독 활용.
- Cloudflare Worker — δ 경로에서 불필요.
- 로컬 Claude CLI 바이너리 실행.
- Claude Projects 자동 API 업로드 — 공식 API 없음.
- 실시간 협업, 동시 편집.
- 오디오 녹음 (Web Speech 받아쓰기만 허용).
- 위키 Lint·Follow-up·Weekly Report (데스크탑 전용).
- **GitHub Pages 배포 — v4에서 제외.** Private repo + Pro 구독 조합은 비용 발생, Cloudflare Pages가 무료로 해결.
- **코드·커밋 메시지에 회사명·구체 업무 맥락 포함** — Private repo라도 위생상 제외.

---

## 4. 데이터 흐름

### 4.1 읽기
```
사용자 탭 → TreeNav.onNodeClick(path)
         → IndexedDB 캐시 확인
             ├ hit  → 즉시 렌더
             └ miss → GitHubClient.getContents(path) → base64 decode → upsert → 렌더
```

### 4.2 쓰기 (inbox)
```
사용자 "메모 전송" → InboxWriter.submit(text, attachments?)
                → 파일명: inbox/YYYY/MM/DD-HHMMSS-{slug}.md
                → GitHubClient.putContents(path, body, `mobile-inbox: {slug}`)
                → IndexedDB sent_memos 기록
                → 토스트: "✓ inbox에 저장됨"
```

### 4.3 Bridge to Claude
```
사용자 문서 탭 → "💬 Claude에 묻기" 버튼
  ↓
BridgeToClaudeService.share(doc)
  ├ 공유 텍스트 조립
  ├ navigator.share() 호출 (iOS/Android 공유 시트)
  └ Claude 앱이 텍스트를 새 대화 입력창에 로드
```

### 4.4 Project Sync
```
데스크탑 ProjectSyncPanel → "Export" 버튼
  ↓
ProjectSyncService.export()
  ├ CLAUDE.md 생성
  ├ wiki/people/ → people.md 병합
  ├ wiki/projects/ → projects.md 병합
  ├ wiki/issues/ → issues.md 병합
  ├ wiki/notes/ → notes.md 병합
  ├ 최근 N개월 markdown/ → recent-markdown.md
  └ ~/TCC-data/_project-sync/에 출력
  ↓
사용자가 claude.ai에서 수동 드래그 드롭
```

### 4.5 배포 흐름 (v4 신규)
```
로컬 변경 → git commit → git push origin main
                              ↓
                   Cloudflare Pages가 GitHub 감지
                              ↓
                   npm install + npm run build 자동 실행
                              ↓
                   dist/ 내용을 workwiki-mobile.pages.dev에 배포
                              ↓
                   URL 유지, 내용만 갱신 (평균 1~2분)
```

---

## 5. 데이터 모델

### 5.1 `worklog_log` repo (읽기만)

```
worklog_log/
├── journals/YYYY/MM/DD.json
├── markdown/YYYY/MM/DD_{slateId}.md
├── wiki/
│   ├── index.md
│   ├── log.md (append-only)
│   ├── people/{name}.md
│   ├── projects/{slug}.md
│   ├── issues/{slug}.md
│   └── notes/{slug}.md
└── meta-index.json
```

### 5.2 신규 `inbox/` (모바일 쓰기 전용)

```
worklog_log/inbox/
├── YYYY/MM/DD-HHMMSS-slug.md
└── assets/YYYYMMDD-HHMMSS.jpg
```

**파일명 규칙.** KST 타임스탬프. `slug`는 첫 줄에서 한글/영문/숫자 추출 kebab-case, 최대 40자.

### 5.3 inbox 마크다운 스펙

```markdown
---
source: mobile
created_at: 2026-04-19T14:23:05+09:00
device: iPhone 15 Pro (Safari)
attachments:
  - assets/20260419-142305.jpg
tags: [quick-memo]
---

본문 마크다운.
```

### 5.4 `~/TCC-data/_project-sync/` 구조

```
_project-sync/
├── CLAUDE.md
├── people.md
├── projects.md
├── issues.md
├── notes.md
├── recent-markdown.md
└── meta-index.json
```

---

## 6. 핵심 기능 명세

### 6.1 AuthManager
GitHub PAT 수집·저장·검증. `localStorage.gh_pat`. 즉시 `GET /user`로 검증.

### 6.2 GitHubClient
```typescript
interface GitHubClient {
  getContents(path: string): Promise<FileContent | DirEntry[]>
  getTree(sha?: string, recursive?: boolean): Promise<TreeNode[]>
  getBlob(sha: string): Promise<string>
  putContents(path: string, content: string, message: string): Promise<PutResult>
  getLatestCommitSha(branch?: string): Promise<string>
  getRateLimit(): Promise<RateLimit>
}
```
`putContents`의 `path`는 반드시 `inbox/` 시작. 런타임 가드 필수.

### 6.3 InboxWriter
첫 줄 → slug, 현재 KST → 파일명. 첨부 이미지 먼저, 본문 마지막 commit. 오프라인 시 `pending_memos` 큐.

### 6.4 TreeNav
```
📁 Today      (오늘 markdown + journals 요약)
📁 Wiki       (People/Projects/Issues/Notes)
📁 Recent     (LRU 20)
📁 Inbox (Sent)
```

### 6.5 MarkdownView
`react-markdown` + `remark-gfm` + `rehype-highlight`. wikilink 커스텀 플러그인. 하단에 `<BridgeToClaudeButton>` 삽입.

### 6.6 SearchIndex
초기 로드 시 wiki 전체 IndexedDB 캐시. `MiniSearch`. 하루 1회 갱신.

### 6.7 QuickMemo (FAB)
전체화면 bottom sheet. 🎤 / 📷 / 🏷️. 전송 → InboxWriter.

### 6.8 BridgeToClaudeService

```typescript
interface BridgeToClaudeService {
  share(doc: Document): Promise<BridgeResult>
  canUseNativeShare(): boolean
}

type BridgeResult =
  | { kind: 'native-share'; shared: true }
  | { kind: 'clipboard-fallback'; copiedText: string; claudeAppUrl: string }
```

텍스트 포맷은 Workwiki 문서 제목·경로·최종수정·본문·"이 내용에 대해 질문드립니다" 라인.

### 6.9 데스크탑 ProjectSyncService

위치: `Worklog/src/main/services/project-sync-service.ts`

```typescript
interface ProjectSyncService {
  export(options?: ExportOptions): Promise<ExportResult>
  getLastExportTime(): Promise<Date | null>
  openExportFolder(): Promise<void>
}
```

카테고리별 병합, 최근 3개월 markdown, 30MB 초과 시 자동 분할.

### 6.10 데스크탑 ProjectSyncPanel
SidePanel에 "🔄 Project Sync" 아이콘. export 버튼, 결과 파일 목록, 폴더 열기 버튼, 수동 업로드 안내.

### 6.11 디자인 토큰 적용 (v4 신규)

Claude Code는 Claude Design 핸드오프 번들을 fetch하여 다음을 파악해 적용한다.

- 라이트/다크 모드 색상 토큰 (CSS 변수로 구현)
- 타이포그래피 (한글 가독성 우선)
- 간격 체계
- 컴포넌트별 구조와 상호작용
- 아이콘 세트

**구현 방식.** 번들의 CSS/Tailwind 클래스를 그대로 가져오되, React 컴포넌트화하여 SPEC §10.1 폴더 구조에 맞춰 배치한다. 번들의 HTML 파일(HomeView.html 등)은 React 컴포넌트로 변환된다.

**테마 전환.** 시스템 자동이 기본값. Settings에서 라이트/다크/시스템 자동 3옵션 선택. 전환 시 즉시 반영.

---

## 7. CLAUDE.md 템플릿 (ProjectSyncService가 자동 생성)

§7은 Workwiki Mobile의 CLAUDE.md가 아니라 **데스크탑 ProjectSyncService가 Claude Projects용으로 자동 생성하는 CLAUDE.md**다. Workwiki Mobile 프로젝트 자체의 CLAUDE.md는 별도 문서에 있다.

```markdown
# Workwiki — 서영균 업무 컨텍스트

## 주체자 정체성
- 이름: 서영균
- 소속: 배터리 도메인 업무혁신 담당
- 주요 성과: c-DN(Cell Design Navigator) 플랫폼의 주 아키텍트

## c-DN (Cell Design Navigator) — 용어 규약
c-DN은 셀 도메인의 설계 데이터 플랫폼입니다.
**반드시 "c-DN"으로 표기하며, Content Delivery Network(CDN)과 절대 혼동하지 마십시오.**

## 응답 스타일 지침
- 현대 한국어 평어체 (~습니다/~입니다)
- 분석 말미에 "기억해야 할 핵심 요약" (음슴체) 덧붙임
- 비판은 명확하되 타당한 부분을 먼저 짚고 반론
- c-DN 표기, 용어 정확성 준수
```

주의: ProjectSyncService가 생성하는 CLAUDE.md는 **Claude Projects 업로드용**이며 Workwiki Mobile 코드 생성에 쓰이는 CLAUDE.md와 다른 목적이다.

---

## 8. 보안 설계

### 8.1 위협 모델

| 위협 | 대응 |
|------|------|
| GitHub PAT 유출 (XSS) | 외부 스크립트 전면 금지, CSP 엄격 |
| PAT 유출 (기기 분실) | Fine-grained PAT, contents:write only, 90일 만료 |
| Anthropic API Key 관련 | 해당 없음 — Key 사용하지 않음 |
| 중간자 공격 | HTTPS only (Cloudflare 자동 제공) |
| 의도치 않은 덮어쓰기 | putContents `inbox/` path guard |
| 저장소 공개 유출 | **Private repo로 해결** |
| LG 사내망 | LTE/5G 사용 권고 UI |

### 8.2 CSP

```
default-src 'self';
connect-src 'self'
    https://api.github.com
    https://raw.githubusercontent.com;
img-src 'self' data: https://raw.githubusercontent.com;
style-src 'self' 'unsafe-inline';
script-src 'self';
```

### 8.3 PAT 권한
Fine-grained PAT, 해당 repo Contents Read & Write only, 기타 No access, 90일 만료.

---

## 9. 기술 스택

| 범주 | 선택 |
|------|------|
| 빌드 | Vite 5 |
| 언어 | TypeScript 5.3 strict |
| 프레임워크 | React 18 |
| PWA | vite-plugin-pwa + Workbox |
| 마크다운 | react-markdown + remark-gfm + rehype-highlight |
| 검색 | MiniSearch |
| 로컬 DB | idb |
| 스타일 | **Claude Design 핸드오프 번들에서 결정됨** (Tailwind 가능성 높음) |
| 테마 | 라이트/다크/시스템 자동 3옵션. 구체 토큰은 핸드오프 번들 참조 |
| 호스팅 | **Cloudflare Pages (무료, Private repo 지원)** |

### 9.1 PWA manifest

```json
{
  "name": "Workwiki Mobile",
  "short_name": "Workwiki",
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`background_color`, `theme_color`는 Claude Design 핸드오프 번들의 primary 컬러에서 가져올 것.

### 9.2 Service Worker 캐시
- App shell: CacheFirst
- GitHub API GET: StaleWhileRevalidate, TTL 1h
- 이미지: CacheFirst, LRU 100
- PUT: 캐시 금지
- 오프라인 PUT: `pending_memos` IndexedDB 큐

---

## 10. 폴더 구조

### 10.1 `workwiki-mobile` (로컬: `C:\01_Antigravity\15_work_log_mobile\`)

```
15_work_log_mobile/
├── CLAUDE.md                       # ⭐ v4 신규 - 프로젝트 작업 규율
├── CLOUDFLARE_SETUP.md             # ⭐ v4 신규 - 배포 가이드
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── index.html
├── .gitignore
├── docs/                           # 참조 문서
│   ├── WORKWIKI_MOBILE_SPEC_v4.md
│   ├── WORKWIKI_MOBILE_DESIGN_BRIEF_v2.md
│   └── claude-design-handoff/      # 로컬 참조 (URL 번들과 동일 내용)
│       └── design.txt
├── public/
│   ├── manifest.webmanifest
│   └── icons/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── TreeNav.tsx
    │   ├── MarkdownView.tsx
    │   ├── SearchBar.tsx
    │   ├── QuickMemoSheet.tsx
    │   ├── AuthGate.tsx
    │   └── BridgeToClaudeButton.tsx
    ├── services/
    │   ├── GitHubClient.ts
    │   ├── InboxWriter.ts
    │   ├── SearchIndex.ts
    │   ├── AuthManager.ts
    │   ├── db.ts
    │   └── BridgeToClaudeService.ts
    ├── hooks/
    │   ├── useWikiTree.ts
    │   ├── useDocument.ts
    │   ├── usePendingQueue.ts
    │   └── useTheme.ts             # ⭐ 라이트/다크/시스템 자동
    ├── utils/
    │   ├── slugify.ts
    │   ├── frontmatter.ts
    │   └── wikilink.ts
    └── types.ts
```

**v3 대비 변경.** `.github/workflows/deploy.yml` 제거. `CLOUDFLARE_SETUP.md`로 대체. `docs/` 폴더 명시.

### 10.2 데스크탑 Workwiki (별도 작업, Worklog repo)

```
Worklog/src/main/services/
├── inbox-service.ts
└── project-sync-service.ts

Worklog/src/renderer/components/panel/
├── InboxPanel.tsx
└── ProjectSyncPanel.tsx
```

---

## 11. 구현 마일스톤

| M | 범위 | 완료 조건 | 공수 |
|---|------|-----------|------|
| M0 | 핸드오프 번들 fetch + 디자인 시스템 추출 | 토큰·컴포넌트 맵 생성 | 반나절 |
| M1 | PWA 스캐폴드 + CLOUDFLARE_SETUP.md 작성 | SC-29, 30 | 반나절 |
| M2 | AuthGate + GitHubClient | SC-01 | 반나절 |
| M3 | TreeNav + MarkdownView | SC-02, 03 | 하루 |
| M4 | Today + Recent + SW 캐시 | SC-04, 06 | 반나절 |
| M5 | SearchIndex + 검색 UI | SC-07, 08, 09 | 하루 |
| M6 | QuickMemo + InboxWriter | SC-10, 11, 12 | 하루 |
| M7 | 음성·카메라 + 배포 | SC-13, 14, 31, 32 | 반나절 |
| M8 | 데스크탑 InboxService + InboxPanel | SC-15~18 | 이틀 |
| M9 | BridgeToClaudeService + 버튼 | SC-19′~23′ | 반나절 |
| M10 | 데스크탑 ProjectSyncService | SC-24~26 | 하루 |
| M11 | ProjectSyncPanel + Claude Project 초기 구축 | SC-27, 28 | 반나절 |

**총 공수.** 1인 개발자 기준 약 9~10일. Claude Code 활용 시 4~5일.

**중간 점검 포인트.** M3, M6, M7 완료 시점에 사용자 확인 필요.

---

## 12. 데스크탑 Workwiki 측 변경사항 요약

- **신규 서비스 2종.** `InboxService` (Phase 4), `ProjectSyncService` (Phase 6)
- **신규 패널 2종.** `InboxPanel.tsx`, `ProjectSyncPanel.tsx`
- **`GitPanel.tsx` 개선.** pull 직후 inbox scan, StatusBar 배지
- **변경 없는 것.** 기존 15개 서비스, 데이터 스키마, v3.13 ClaudeChatTerminal

---

## 13. 수용 기준

**자동화.**
- `tsc --noEmit` pass
- Vite `build` pass
- Lighthouse PWA 90+
- Cloudflare Pages 배포 성공

**수동 검증.**
- iPhone Safari 홈화면 추가 standalone
- Android Chrome WebAPK 설치
- 기내 모드 캐시 문서 열람
- Web Share API로 Claude 앱 연결
- Claude Projects 수동 업로드 후 대화 품질 확인

---

## 14. 설계 결정 로그 (ADR)

### ADR-001. 왜 서버(FastAPI)를 두지 않는가
GitHub가 이미 저장·버전·인증·CDN 역할. 중간 계층 제거로 SPOF 감소.

### ADR-002. 왜 Capacitor가 아니라 PWA인가
네이티브 플러그인 불필요. 배포 경로 단순.

### ADR-003. 왜 폰은 기존 파일을 수정하지 않는가
Merge conflict UX는 모바일에 치명적. `inbox/` append-only로 원천 봉쇄.

### ADR-004. 왜 IndexedDB 캐시를 두는가
검색 인덱스 구축에 전체 wiki를 메모리에 올려야 함. Cache API보다 적합.

### ADR-005. 왜 PAT을 평문 저장하는가
XSS 없으면 평문 안전, 있으면 암호화도 무의미. 투자 방향은 CSP와 권한 최소화.

### ADR-006. 왜 첨부 이미지를 base64로 commit하는가
Contents API가 base64만 받음. Git Data API는 과도한 복잡도.

### ADR-007. 왜 검색 인덱스를 클라이언트에서 만드는가
ADR-001과 일관. 수백 파일 규모면 클라이언트 색인 1초 이내.

### ADR-008. 왜 자체 AI 채팅을 만들지 않는가
claude.ai가 이미 최상급 채팅 PWA이며 Max 구독 자동 적용. 재구현 이유 없음.

### ADR-009. 왜 deep link가 아니라 Web Share API인가
claude.ai/new?q= URL 파라미터는 2025-10월 제거됨. Web Share API가 OS 레벨 공식 통합.

### ADR-010. 왜 Claude Projects 업로드는 수동인가
Anthropic이 공식 업로드 API를 제공하지 않음. 브라우저 자동화는 정책 리스크.

### ADR-011. 왜 ProjectSync의 export 단위를 카테고리 병합으로 하는가
Projects의 청크 단위 RAG 특성상 관련 내용이 같은 파일에 있어야 맥락 일관. 30MB 한도 내 병합이 최적.

### ADR-012. 왜 recent-markdown은 3개월로 제한하는가
Projects RAG는 관련 부분만 retrieve. 오래된 일지는 wiki에 이미 정제됨. 파일 크기 제약도 있음.

### ADR-013. 왜 Cloudflare Pages인가 ⭐ v4
세 가지 이유.

1. **Private repo + 무료.** GitHub Pages는 Private에 Pro 구독 필요. Cloudflare는 무료로 동일 기능 제공.
2. **한국 저지연.** Cloudflare CDN이 한국에서 GitHub Pages보다 빠름.
3. **자동 빌드.** Git push만으로 자동 재배포. GitHub Actions 워크플로우 불필요.

대안 Vercel·Netlify도 가능하나 Cloudflare가 한국 성능 우위.

### ADR-014. 왜 디자인 구체 값을 SPEC에 담지 않는가 ⭐ v4
Claude Design 핸드오프 번들이 단일 진실의 출처이며, Claude Code가 URL에서 직접 fetch 가능. SPEC에 디자인 값을 중복 기입하면 업데이트 시 drift 발생. 분리 유지로 두 문서의 책임이 명확해짐.

### ADR-015. 왜 회사 맥락을 코드에서 제거하는가 ⭐ v4
Private repo라도 미래 공개 가능성 염두. 주석·변수명·커밋 메시지에 회사명·구체 업무 맥락 없이 일반화된 표현 사용. 이는 기술적 정당성보다 위생 원칙에 가까움.

---

## 15. 미해결 쟁점 (Known Unknowns)

1. **worklog_log 용량 증가.** 100MB 넘어가면 초기 인덱스 지연.
2. **meta-index.json 크기.** 임계 이상이면 lazy parse.
3. **LG 사내망.** GitHub API 차단 가능성.
4. **iOS Safari 한글 STT 품질.**
5. **Claude Projects 자동 갱신 API.**
6. **Web Share API 지원 범위.**
7. **Claude 앱 공유 시트 수신 동작 변경.**
8. **핸드오프 번들 URL 유효기간.** Anthropic이 언제까지 이 URL을 유지하는지 확인 필요. 만료 전 로컬에 `design.txt`로 백업 권장.

---

## 16. 참조 문서

- **Workwiki Mobile Design Brief v2** — 짝이 되는 디자인 맥락 문서
- **CLAUDE.md** (프로젝트 루트) — 에이전트 작업 규율
- **Claude Design 핸드오프 번들** — `https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q`
- **CLOUDFLARE_SETUP.md** — 배포 설정 가이드 (M1에서 Claude Code가 생성)
- **데스크탑 Workwiki KNOWLEDGE.md·WIKI_ARCHITECTURE.md·CLAUDE.md**
- **GitHub REST API v3** — https://docs.github.com/en/rest
- **vite-plugin-pwa** — https://vite-pwa-org.netlify.app/
- **Web Share API (MDN)** — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- **Cloudflare Pages 문서** — https://developers.cloudflare.com/pages/

---

## 17. 기억해야 할 핵심 요약

서버는 두지 않음. GitHub Private Repo가 백엔드임. Cloudflare Pages가 배포처임.

폰은 읽기 + inbox 쓰기만. 기존 파일 수정은 절대 금지임.

AI 채팅은 claude.ai 위임. 자체 채팅 UI 만들지 않음.

Max 구독은 claude.ai와 공식 앱에서만 유효함. 제3 도메인 PWA는 불가능함.

디자인은 Claude Design 핸드오프 URL이 단일 진실의 출처임. SPEC에 구체 값 없음.

Cloudflare Pages는 Private repo + 무료 + 한국 빠름 세 조건 모두 만족함.

라이트/다크는 동등 품질로 구현, 시스템 자동 기본값임.

회사명·업무 맥락은 코드에 넣지 말 것. Private이어도 위생 원칙임.

총 공수 9~10일, Claude Code 활용 시 4~5일.

M3·M6·M7은 중간 점검 필수. 사용자 확인 후 진행함.

저장소는 넷으로 나뉨: Worklog(코드), worklog_log(데이터), workwiki-mobile(PWA), design handoff URL(디자인).
