# Workwiki Mobile (PWA) — 구현 명세서 v5

> **문서 용도.** Claude Code가 이 파일 하나만 읽고 Workwiki Mobile 프로젝트를
> 처음부터 끝까지 구현할 수 있도록 작성되었다. 코드 작성 전 §1~§3을 반드시 선독하라.
>
> **작성 기준일.** 2026-04-19
> **변경 이력.**
> - v1: 초안 (길 3.5 = GitHub API 기반 PWA)
> - v2: 저장소 경로 정정 + Phase 5 (자체 CLI-style 채팅) 추가
> - v3: Phase 5 제거 → Phase 5′ (Bridge to claude.ai). Phase 6 (Claude Projects 연동) 추가
> - v4: Cloudflare Pages 배포, 로컬 작업 경로, Claude Design 핸드오프 URL 연결
> - **v5: M0 핸드오프 분석 결과 반영. CalendarView 추가(11번째 화면). 테마 정책 확정(라이트/다크/시스템 자동, Ant Design 제외). Liquid Glass 크롬 공식 수용. 디자인 자산 로컬 파일 우선 원칙.**
>
> **대상 에이전트.** Claude Sonnet 4.6+ / Opus 4.7+
> **선행 지식.** Workwiki v3.16 데스크탑(Electron), Claude Projects, Claude Design 핸드오프 형식

---

## 0. Executive Summary

- 이것은 데스크탑 Workwiki의 **모바일 보조 클라이언트(PWA)**.
- 네이티브 앱이 아니라 PWA. 앱스토어 배포 없음.
- 서버 없음. **GitHub 저장소가 백엔드**. 채팅 서버도 없음.
- 데이터 저장소 `doroper98/worklog_log`는 이미 존재하며 데스크탑이 push.
- 폰은 그 repo를 GitHub REST API로 **읽기** + `inbox/` 폴더에만 **쓰기**.
- **AI 채팅은 claude.ai에 위임** — Web Share API로 Claude 앱에 전달.
- 데스크탑 Workwiki에 **Project Sync** 기능 신설.
- 배포: Cloudflare Pages (Private repo + 무료 + 한국 저지연).
- **디자인은 로컬 핸드오프 자산 우선 참조** (URL은 백업 수단).
- **테마: 라이트/다크/시스템 자동 3옵션.** Ant Design 팔레트는 Settings 노출 안 함.
- **Liquid Glass 크롬** (iOS 26 스타일 backdrop-filter) 공식 수용. Android 저사양 폴백 포함.

---

## 1. 정체성과 맥락

### 1.1 프로젝트 기본 정보

| 항목 | 값 |
|------|----|
| 프로젝트명 | Workwiki Mobile |
| 코드명 | `workwiki-mobile` |
| 배포 형태 | PWA (Cloudflare Pages) |
| 배포 URL | `https://workwiki-mobile.pages.dev` (예정) |
| 타깃 플랫폼 | iOS Safari 16+, Android Chrome 최신 |
| 로컬 작업 경로 | `C:\01_Antigravity\15_work_log_mobile\` |
| 코드 저장소 | `github.com/doroper98/workwiki-mobile` (Private) |
| 데이터 저장소 (기존) | `github.com/doroper98/worklog_log` (Private) |
| 참조: 데스크탑 Workwiki 코드 | `github.com/doroper98/Worklog` |
| **디자인 핸드오프 로컬 경로** | `docs\claude-design-handoff\` |
| 디자인 핸드오프 URL (백업) | `https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q` |
| AI 채팅 | claude.ai 공식 PWA/앱 위임 |
| Claude Project (신규) | "Workwiki — 서영균 업무 컨텍스트" |
| 주체자 | 서영균 (doroper98) |

### 1.2 디자인 출처 (v5 변경)

**로컬 파일이 단일 진실의 출처.** `docs/claude-design-handoff/` 폴더의 실제 HTML·CSS·자산이 디자인 구현의 기반이다.

**URL은 백업 수단.** 로컬 자산이 유실되거나 새 핸드오프를 받아야 할 경우에만 URL을 재시도한다. M0 단계에서 URL fetch가 404를 반환한 사례가 있으므로 URL에 의존하지 않는다.

### 1.3 핸드오프에서 확인된 사실 (M0 결과)

**번들 내 제공 화면 3종.**
- `HomeView.html` — 홈 진입 화면
- `SlateDetail.html` — 문서/일지 상세 화면 (= SPEC의 MarkdownView)
- `CalendarView.html` — **신규 통찰. 달력 기반 일지 탐색.**

**번들 내 테마 팔레트 3종.**
- Light — 라이트 모드 토큰으로 채택
- Dark — 다크 모드 토큰으로 채택
- **Ant Design — 제품 테마로는 채택 안 함.** 참조 라이브러리로만 간주.

**디자인 언어 특징.**
- Liquid Glass 크롬 (iOS 26 스타일 backdrop-filter 전면 적용)
- 반투명 레이어 위주, 낮은 채도
- 정보 밀도와 여백의 균형

---

## 2. GOAL — 성공 기준

### Phase 1 — 조회 (Read-only)
- **SC-01.** PAT 입력 폼이 뜬다.
- **SC-02.** PAT 입력 후 `wiki/` 하위 마크다운이 트리로 표시된다.
- **SC-03.** wiki 파일 탭 시 본문이 렌더링된다.
- **SC-04.** 오늘의 `markdown/YYYY/MM/DD_*.md`가 "오늘의 일지" 섹션에 노출된다.
- **SC-05.** 홈화면 추가 시 standalone 모드로 실행된다.
- **SC-06.** 네트워크 차단 상태에서도 캐시된 문서는 표시된다.
- **SC-06′.** **달력 뷰에서 월별로 작성된 일지가 있는 날짜가 하이라이트된다.** ⭐ v5 신규

### Phase 2 — 검색
- **SC-07.** 전문 검색창에서 위키 전체 텍스트 substring 검색.
- **SC-08.** 검색 결과 문서 열면 검색어 하이라이트.
- **SC-09.** meta-index 기반 people/projects 패싯 필터.

### Phase 3 — 쓰기 (Inbox Write)
- **SC-10.** FAB 탭 시 입력 모달.
- **SC-11.** "전송" 시 `inbox/YYYY/MM/DD-HHMMSS-slug.md` commit.
- **SC-12.** IndexedDB 저장으로 오프라인 열람 가능.
- **SC-13.** Web Speech API 받아쓰기.
- **SC-14.** 카메라 첨부.

### Phase 4 — 데스크탑 연동
- **SC-15.** 데스크탑에 `InboxService` 신설, `inbox/` 스캔.
- **SC-16.** `GitPanel` 배지.
- **SC-17.** 네 가지 처리 액션.
- **SC-18.** 처리 완료 자동 commit.

### Phase 5′ — Bridge to Claude
- **SC-19′.** 각 문서 하단에 "💬 Claude에 묻기" 버튼.
- **SC-20′.** Web Share API로 공유 시트 호출.
- **SC-21′.** 제목·본문·경로 구조화.
- **SC-22′.** Claude 앱에 내용 로드.
- **SC-23′.** Web Share 미지원 시 클립보드 폴백.

### Phase 6 — Claude Projects 연동 (데스크탑)
- **SC-24.** `ProjectSyncService` 신설.
- **SC-25.** 주 1회 export.
- **SC-26.** CLAUDE.md + 카테고리별 병합 파일.
- **SC-27.** `ProjectSyncPanel`.
- **SC-28.** 수동 업로드.

### Phase 배포 — Cloudflare Pages
- **SC-29.** `CLOUDFLARE_SETUP.md` 존재.
- **SC-30.** Vite 빌드 `dist/` 정상 생성.
- **SC-31.** Cloudflare Pages 자동 배포 성공.
- **SC-32.** HTTPS PWA 정상 동작.

### Phase 디자인 — Liquid Glass 적용 ⭐ v5 신규
- **SC-33.** 모든 상단 바·bottom sheet·모달에 backdrop-filter 적용.
- **SC-34.** 라이트 모드와 다크 모드 각각의 blur tint 컬러 구분.
- **SC-35.** `prefers-reduced-motion: reduce` 사용자는 blur 비활성.
- **SC-36.** `@supports not (backdrop-filter: blur(20px))` 환경은 불투명 배경 폴백.
- **SC-37.** Android Chrome 저사양 기기에서 blur 강도 자동 감소.

---

## 3. 비목표 (Out of Scope)

- 기존 `journals/*.json`, `markdown/**/*.md`, `wiki/**/*.md`, `meta-index.json`, `log.md`의 수정.
- 자체 AI 채팅 UI.
- Anthropic API 직접 호출.
- Cloudflare Worker.
- 로컬 Claude CLI 바이너리 실행.
- Claude Projects 자동 API 업로드.
- 실시간 협업, 동시 편집.
- 오디오 녹음 (Web Speech 받아쓰기만).
- 위키 Lint·Follow-up·Weekly Report.
- GitHub Pages 배포.
- 회사명·구체 업무 맥락 코드 포함.
- **Ant Design 팔레트를 Settings 테마 옵션으로 노출** ⭐ v5 신규
- **핸드오프 번들의 CalendarView 외 다른 날짜 기반 뷰 신규 설계** — CalendarView 하나로 통합.

---

## 4. 데이터 흐름

### 4.1 읽기
```
사용자 탭 → TreeNav.onNodeClick(path)
         → IndexedDB 캐시 확인
             ├ hit  → 즉시 렌더
             └ miss → GitHubClient.getContents(path) → decode → upsert → 렌더
```

### 4.2 쓰기 (inbox)
```
사용자 "메모 전송" → InboxWriter.submit(text, attachments?)
                → 파일명: inbox/YYYY/MM/DD-HHMMSS-{slug}.md
                → GitHubClient.putContents(path, body, `mobile-inbox: {slug}`)
                → IndexedDB sent_memos 기록
                → 토스트
```

### 4.3 Bridge to Claude
```
사용자 문서 탭 → "💬 Claude에 묻기" 버튼
              → BridgeToClaudeService.share(doc)
              → navigator.share() 또는 클립보드 폴백
              → Claude 앱 새 대화에 로드
```

### 4.4 Project Sync (데스크탑)
```
ProjectSyncPanel → "Export"
                → ProjectSyncService.export()
                → CLAUDE.md + 카테고리별 병합 파일 생성
                → ~/TCC-data/_project-sync/에 출력
                → 사용자 수동 드래그 드롭 to claude.ai
```

### 4.5 배포
```
로컬 변경 → git commit → git push origin main
        → Cloudflare Pages 자동 감지
        → npm install + npm run build
        → dist/ 배포
        → workwiki-mobile.pages.dev 갱신
```

### 4.6 CalendarView 데이터 흐름 ⭐ v5 신규
```
사용자 HomeView에서 "📅 달력 보기" 탭
  → CalendarView 진입 (현재 월)
  → GitHubClient.getTree()로 markdown/YYYY/MM/ 하위 파일 목록 조회 (IndexedDB 캐시 우선)
  → 각 파일명에서 DD 추출하여 작성된 날짜 Set 생성
  → 달력 그리드에 해당 날짜 하이라이트 (번들 디자인 토큰 사용)
  → 날짜 탭 시 해당 날의 markdown 파일 목록 → MarkdownView
  → 이전 달/다음 달 내비게이션 (스와이프 또는 버튼)
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
GitHub PAT 수집·저장·검증. `localStorage.gh_pat`. `GET /user`로 검증.

### 6.2 GitHubClient
```typescript
interface GitHubClient {
  getContents(path: string): Promise<FileContent | DirEntry[]>
  getTree(sha?: string, recursive?: boolean): Promise<TreeNode[]>
  getBlob(sha: string): Promise<string>
  putContents(path: InboxPath, content: string, message: string): Promise<PutResult>
  getLatestCommitSha(branch?: string): Promise<string>
  getRateLimit(): Promise<RateLimit>
}

type InboxPath = `inbox/${string}`  // 타입 가드
```

### 6.3 InboxWriter
첫 줄 → slug, KST 타임스탬프. 첨부 먼저, 본문 마지막 commit. 오프라인 시 `pending_memos` 큐.

### 6.4 TreeNav
```
📁 Today       (오늘 markdown + journals 요약)
📅 Calendar    (달력 뷰 진입)                 ⭐ v5 신규
📁 Wiki        (People/Projects/Issues/Notes)
📁 Recent      (LRU 20)
📁 Inbox (Sent)
⚙ Settings
```

### 6.5 MarkdownView (번들 SlateDetail 매핑)
`react-markdown` + `remark-gfm` + `rehype-highlight`. wikilink 플러그인. 하단 고정 액션 바에 `<BridgeToClaudeButton>`.

번들 `SlateDetail.html`의 레이아웃·타이포·간격을 그대로 따른다.

### 6.6 SearchIndex
초기 로드 시 wiki 전체 IndexedDB 캐시. `MiniSearch`. 하루 1회 갱신.

### 6.7 QuickMemo (FAB)
전체화면 bottom sheet. 🎤 / 📷 / 🏷️. **Liquid Glass 적용.**

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

### 6.9 CalendarView ⭐ v5 신규

**번들 `CalendarView.html` 기반 직접 구현.**

**책임.** 월 단위 달력 UI로 과거 일지 탐색.

**구성 요소.**
- 상단 월/년 표시 + 이전·다음 월 버튼
- 7×N 그리드 (일~토)
- 일지가 작성된 날짜는 시각적으로 하이라이트 (번들 색상 토큰)
- 날짜 탭 시 해당 날의 마크다운 파일 목록 bottom sheet
  - 파일이 1개면 즉시 MarkdownView로 이동
  - 여러 개면 리스트에서 선택

**데이터 로딩.**
- 현재 월 진입 시 `markdown/YYYY/MM/` 트리 조회
- 이전/다음 월 이동 시 해당 월 트리 조회
- 한 번 조회한 월은 IndexedDB 캐시 (TTL 1일)

**제스처.**
- 좌우 스와이프로 이전/다음 월 이동 (iOS·Android 공통)
- 오늘로 돌아가기 버튼 (상단 "오늘" 라벨)

**번들 디자인 준수.**
- Liquid Glass 크롬 상단 바
- 날짜 셀 간격·타이포 번들 그대로
- 하이라이트는 번들의 accent 토큰 사용

### 6.10 데스크탑 ProjectSyncService

위치: `Worklog/src/main/services/project-sync-service.ts`

```typescript
interface ProjectSyncService {
  export(options?: ExportOptions): Promise<ExportResult>
  getLastExportTime(): Promise<Date | null>
  openExportFolder(): Promise<void>
}
```

카테고리별 병합, 최근 3개월 markdown, 30MB 초과 시 자동 분할.

### 6.11 데스크탑 ProjectSyncPanel
SidePanel에 "🔄 Project Sync" 아이콘. export 버튼, 결과 목록, 폴더 열기, 수동 업로드 안내.

### 6.12 디자인 토큰 적용

Claude Code는 `docs/claude-design-handoff/` 폴더의 HTML·CSS를 읽어 다음을 추출한다.

- 라이트/다크 모드 색상 토큰 (CSS 변수)
- 타이포그래피 (한글 가독성 우선)
- 간격 체계
- 컴포넌트별 구조와 상호작용
- 아이콘 세트
- **Liquid Glass 파라미터** (blur 강도, saturate, tint 컬러 per 테마)

**Ant Design 팔레트는 추출 대상에서 제외.**

**구현 방식.** 번들 CSS/Tailwind 클래스를 React 컴포넌트화. 번들 HTML 3종(HomeView, SlateDetail, CalendarView)은 그대로 구현. 나머지 8화면은 번들 디자인 언어로 파생 구현.

### 6.13 테마 시스템 ⭐ v5 명시

**지원 테마 3옵션:**
1. 라이트
2. 다크
3. 시스템 자동 (기본값)

**제외되는 것:** Ant Design 팔레트. 번들 자산으로만 보관, CSS 변수 추출 안 함, Settings UI에 노출 안 함.

**구현:**
- `useTheme` 훅으로 중앙 관리
- `prefers-color-scheme` 미디어 쿼리 리스너
- `data-theme` 속성을 `html` 요소에 적용
- Settings 변경 시 즉시 반영, 페이지 리로드 없음

```typescript
type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) || 'system'
  )
  const effectiveTheme = useMemo(() => {
    if (theme !== 'system') return theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' : 'light'
  }, [theme])
  // ...
}
```

### 6.14 Liquid Glass 크롬 ⭐ v5 신규

**적용 대상 컴포넌트:**
- 상단 네비게이션 바
- 하단 탭 바 / FAB 배경
- Bottom Sheet 헤더
- 모달 배경

**CSS 구현:**
```css
.liquid-glass {
  backdrop-filter: blur(20px) saturate(180%);
  background-color: var(--glass-tint);
}

[data-theme="light"] {
  --glass-tint: rgba(255, 255, 255, 0.7);
}

[data-theme="dark"] {
  --glass-tint: rgba(20, 20, 25, 0.7);
}

@media (prefers-reduced-motion: reduce) {
  .liquid-glass {
    backdrop-filter: none;
    background-color: var(--bg-opaque);
  }
}

@supports not (backdrop-filter: blur(20px)) {
  .liquid-glass {
    background-color: var(--bg-opaque);
  }
}
```

**Android 저사양 폴백:**
- `navigator.hardwareConcurrency <= 4` 또는 `navigator.deviceMemory <= 2` 감지 시
- CSS 변수로 blur 강도 `blur(10px)`로 축소
- 매우 저사양(deviceMemory <= 1)은 `blur(0)` + 불투명 배경

---

## 7. CLAUDE.md 템플릿 (ProjectSyncService 자동 생성용)

§7은 Workwiki Mobile의 CLAUDE.md가 아니라 **데스크탑 ProjectSyncService가 Claude Projects용으로 자동 생성하는 CLAUDE.md**다.

```markdown
# Workwiki — 서영균 업무 컨텍스트

## 주체자 정체성
- 이름: 서영균
- 소속: 배터리 도메인 업무혁신 담당
- 주요 성과: c-DN(Cell Design Navigator) 플랫폼의 주 아키텍트

## c-DN 용어 규약
c-DN은 셀 도메인의 설계 데이터 플랫폼.
반드시 "c-DN"으로 표기. Content Delivery Network(CDN)과 절대 혼동 금지.

## 응답 스타일
- 현대 한국어 평어체 (~습니다/~입니다)
- 분석 말미에 "기억해야 할 핵심 요약" (음슴체)
- 비판은 명확하되 타당한 부분 먼저 짚기
- c-DN 표기, 용어 정확성 준수
```

---

## 8. 보안 설계

### 8.1 위협 모델

| 위협 | 대응 |
|------|------|
| GitHub PAT 유출 (XSS) | 외부 스크립트 금지, CSP 엄격 |
| PAT 유출 (기기 분실) | Fine-grained PAT, contents:write only, 90일 만료 |
| Anthropic API Key | 해당 없음 |
| 중간자 공격 | HTTPS only (Cloudflare 자동) |
| 의도치 않은 덮어쓰기 | putContents `inbox/` 타입 가드 |
| 저장소 공개 유출 | Private repo로 해결 |
| LG 사내망 | LTE/5G 사용 권고 |

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
Fine-grained, Contents Read & Write only, 기타 No access, 90일 만료.

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
| 스타일 | Tailwind CSS (번들 토큰 `tailwind.config.ts` 반영) |
| 테마 | **라이트/다크/시스템 자동 3옵션** (Ant Design 제외) ⭐ v5 |
| 특수 효과 | **Liquid Glass (backdrop-filter)** ⭐ v5 |
| 호스팅 | Cloudflare Pages |

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

`background_color`와 `theme_color`는 번들 라이트 팔레트의 primary 값으로 설정.

### 9.2 Service Worker 캐시
- App shell: CacheFirst
- GitHub API GET: StaleWhileRevalidate, TTL 1h
- 이미지: CacheFirst, LRU 100
- PUT: 캐시 금지
- 오프라인 PUT: `pending_memos` 큐

---

## 10. 폴더 구조

### 10.1 `workwiki-mobile` (로컬 루트)

```
15_work_log_mobile/
├── CLAUDE.md
├── CLOUDFLARE_SETUP.md              (M1에서 생성)
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── index.html
├── .gitignore
├── docs/
│   ├── WORKWIKI_MOBILE_SPEC_v5.md   ⭐ 이 파일
│   ├── WORKWIKI_MOBILE_DESIGN_BRIEF_v2.md
│   └── claude-design-handoff/
│       ├── HomeView.html
│       ├── SlateDetail.html
│       ├── CalendarView.html
│       ├── (기타 자산)
│       └── design.txt
├── public/
│   ├── manifest.webmanifest
│   └── icons/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    │   ├── TreeNav.tsx
    │   ├── HomeView.tsx             (번들 직접 매핑)
    │   ├── MarkdownView.tsx         (번들 SlateDetail 매핑)
    │   ├── CalendarView.tsx         ⭐ v5 신규 (번들 직접 매핑)
    │   ├── SearchBar.tsx
    │   ├── WikiCategory.tsx
    │   ├── QuickMemoSheet.tsx
    │   ├── AuthGate.tsx
    │   ├── InboxSent.tsx
    │   ├── SettingsView.tsx
    │   ├── OfflineBanner.tsx
    │   ├── BridgeToClaudeButton.tsx
    │   └── primitives/
    │       ├── LiquidGlassSurface.tsx  ⭐ v5 신규
    │       └── ThemeProvider.tsx
    ├── services/
    │   ├── GitHubClient.ts
    │   ├── InboxWriter.ts
    │   ├── SearchIndex.ts
    │   ├── AuthManager.ts
    │   ├── db.ts
    │   ├── BridgeToClaudeService.ts
    │   └── CalendarService.ts       ⭐ v5 신규
    ├── hooks/
    │   ├── useWikiTree.ts
    │   ├── useDocument.ts
    │   ├── usePendingQueue.ts
    │   ├── useTheme.ts
    │   ├── useLiquidGlass.ts        ⭐ v5 신규 (성능 감지·폴백)
    │   └── useCalendarMonth.ts      ⭐ v5 신규
    ├── utils/
    │   ├── slugify.ts
    │   ├── frontmatter.ts
    │   ├── wikilink.ts
    │   └── deviceCapabilities.ts    ⭐ v5 신규
    ├── styles/
    │   ├── tokens.css               (번들에서 추출)
    │   ├── themes.css               (라이트/다크 매핑)
    │   └── liquid-glass.css         ⭐ v5 신규
    └── types.ts
```

**v4 대비 신규:** CalendarView·LiquidGlassSurface·ThemeProvider·CalendarService·useLiquidGlass·useCalendarMonth·deviceCapabilities·liquid-glass.css.

---

## 11. 구현 마일스톤

| M | 범위 | 완료 조건 | 공수 |
|---|------|-----------|------|
| M0 | 핸드오프 자산 fetch + 디자인 시스템 추출 | 토큰·컴포넌트 맵 생성 | 반나절 |
| M1 | PWA 스캐폴드 + Tailwind + 테마 시스템 + Liquid Glass 기초 + CLOUDFLARE_SETUP.md | SC-29, 30 + 테마 전환 동작 | 하루 |
| M2 | AuthGate + GitHubClient | SC-01 | 반나절 |
| M3 | TreeNav + HomeView + MarkdownView (SlateDetail 매핑) | SC-02, 03 | 하루 |
| **M3.5** | **CalendarView + CalendarService** ⭐ v5 | SC-06′ | **하루** |
| M4 | Today 섹션 + Recent + SW 캐시 | SC-04, 06 | 반나절 |
| M5 | SearchIndex + WikiCategory + SearchBar | SC-07, 08, 09 | 하루 |
| M6 | QuickMemo + InboxWriter | SC-10, 11, 12 | 하루 |
| M7 | 음성·카메라 + SettingsView + OfflineBanner + 배포 | SC-13, 14, 31~37 | 하루 |
| M8 | 데스크탑 InboxService + InboxPanel | SC-15~18 | 이틀 |
| M9 | BridgeToClaudeService + 버튼 + InboxSent + ShareOutcome | SC-19′~23′ | 반나절 |
| M10 | 데스크탑 ProjectSyncService | SC-24~26 | 하루 |
| M11 | ProjectSyncPanel + Claude Project 초기 구축 | SC-27, 28 | 반나절 |

**총 공수.** 1인 개발자 기준 약 10~11일. Claude Code 활용 시 5~6일. (v4 대비 CalendarView 공수 +반나절)

**중간 점검 포인트.** M0, M1, M3, M3.5, M6, M7 완료 시점.

---

## 12. 데스크탑 Workwiki 측 변경사항

- 신규 서비스 2종: `InboxService`, `ProjectSyncService`
- 신규 패널 2종: `InboxPanel.tsx`, `ProjectSyncPanel.tsx`
- `GitPanel.tsx` 개선: pull 후 scan, StatusBar 배지
- **변경 없는 것:** 기존 15개 서비스, 데이터 스키마, v3.13 ClaudeChatTerminal

---

## 13. 수용 기준

**자동화.**
- `tsc --noEmit` pass
- Vite build pass
- Lighthouse PWA 90+
- Cloudflare Pages 배포 성공
- Liquid Glass 지원 브라우저 매트릭스 테스트

**수동 검증.**
- iPhone Safari 홈화면 standalone
- Android Chrome WebAPK 설치
- 기내 모드 캐시 열람
- Web Share API로 Claude 앱 연결
- Claude Projects 수동 업로드 후 대화 품질
- 라이트/다크/시스템 자동 테마 전환 (즉시 반영)
- Liquid Glass가 라이트·다크에서 모두 자연스러움
- Android 저사양 기기에서 blur 폴백 동작

---

## 14. 설계 결정 로그 (ADR)

### ADR-001 ~ ADR-012
v3까지 확정됨. (서버 없음, Capacitor 아님, inbox append-only, IndexedDB 캐시, PAT 평문, base64 커밋, 클라이언트 검색, AI 채팅 위임, Web Share API, 수동 업로드, 카테고리 병합, 3개월 제한)

### ADR-013. 왜 Cloudflare Pages인가 (v4)
Private repo + 무료 + 한국 저지연. GitHub Pages는 Private에 Pro 필요.

### ADR-014. 왜 디자인 구체 값을 SPEC에 담지 않는가 (v4)
핸드오프 번들이 단일 진실의 출처. SPEC 중복 기입은 drift 발생.

### ADR-015. 왜 회사 맥락을 코드에서 제거하는가 (v4)
Private repo라도 위생 원칙. 미래 공개 가능성 염두.

### ADR-016. 왜 Ant Design 팔레트를 제품 테마로 쓰지 않는가 ⭐ v5
세 가지 이유.
1. **역할 혼동 방지.** Ant Design은 참조 디자인 시스템이지 사용자 선택 테마가 아니다.
2. **단일 사용자 UX.** 3테마는 선택 피로만 증가. 낮 야외(라이트), 밤 실내(다크) 두 시나리오로 충분.
3. **시스템 자동이 3번째 옵션.** 사용자가 실제로 "선택"해야 하는 테마는 2개. 시스템 자동은 메타 옵션.

번들 자산으로는 보관하되 CSS 변수 추출·Settings 노출은 하지 않는다.

### ADR-017. 왜 CalendarView를 추가하는가 ⭐ v5
세 가지 이유.
1. **Claude Design의 기여.** 핸드오프 번들에 포함되었다는 사실이 이 기능의 가치를 시사.
2. **기존 데이터 구조와 부합.** `markdown/YYYY/MM/DD_*.md` 계층이 이미 달력 친화적. 추가 서비스 없이 구현 가능.
3. **사용자 시나리오 확장.** "2주 전 그 회의 때 메모 뭐였지?"처럼 기억이 날짜에 앵커링된 경우 Calendar가 Search보다 빠름.

Phase 1 조회에 편입. Phase 추가 없음.

### ADR-018. 왜 Liquid Glass를 전면 채택하는가 ⭐ v5
네 가지 이유.
1. **Brief 원칙과 조화.** 반투명·낮은 채도·정적 효과는 "조용한 유능함"과 부합.
2. **iOS 26 네이티브 정합성.** PWA가 홈화면 standalone으로 실행될 때 OS와 자연스럽게 섞임.
3. **정보 계층의 시각적 강화.** 상단 바·FAB이 콘텐츠 위에 "떠 있음"이 명확해져 공간 인지가 쉬워짐.
4. **폴백 경로가 명확.** `@supports`와 `prefers-reduced-motion` 쿼리로 우아하게 축소 가능.

Android 저사양 성능 이슈는 `deviceCapabilities` 유틸로 런타임 감지하여 blur 강도 조정.

### ADR-019. 왜 로컬 파일을 URL보다 우선시하는가 ⭐ v5
M0 단계에서 URL fetch가 404를 반환한 실제 사례. Research Preview 제품의 API 안정성이 낮음. 로컬 파일은 Git으로 영구 보관되며 네트워크 의존이 없음.

---

## 15. 미해결 쟁점 (Known Unknowns)

1. **worklog_log 용량 증가.** 100MB 넘어가면 초기 인덱스 지연.
2. **meta-index.json 크기.** 임계 이상이면 lazy parse.
3. **LG 사내망.** GitHub API 차단 가능.
4. **iOS Safari 한글 STT 품질.**
5. **Claude Projects 자동 갱신 API.**
6. **Web Share API 지원 범위.**
7. **Claude 앱 공유 시트 수신 동작 변경.**
8. ~~핸드오프 번들 URL 유효기간~~ — **v5에서 해결됨.** 로컬 파일 우선 원칙으로 회피.
9. **Liquid Glass 배터리 영향.** ⭐ v5 신규. 저사양 기기에서 blur가 지속 발열·배터리 소모 유발 가능. 실기기 테스트 후 필요 시 추가 폴백.
10. **CalendarView의 월 트리 조회 비용.** ⭐ v5 신규. 매달 이동 시 API 호출이 발생. IndexedDB 캐시로 해결하나 캐시 무효화 전략 검토 필요.

---

## 16. 참조 문서

- Workwiki Mobile Design Brief v2 (`docs/WORKWIKI_MOBILE_DESIGN_BRIEF_v2.md`)
- CLAUDE.md (프로젝트 루트) — 에이전트 작업 규율
- Claude Design 핸드오프 자산 (`docs/claude-design-handoff/`)
- CLOUDFLARE_SETUP.md (M1에서 생성)
- 데스크탑 Workwiki KNOWLEDGE.md·WIKI_ARCHITECTURE.md·CLAUDE.md
- GitHub REST API v3 — https://docs.github.com/en/rest
- vite-plugin-pwa — https://vite-pwa-org.netlify.app/
- Web Share API (MDN) — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- Cloudflare Pages 문서 — https://developers.cloudflare.com/pages/
- CSS backdrop-filter (MDN) — https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter
- iOS HIG Liquid Glass — https://developer.apple.com/design/human-interface-guidelines/

---

## 17. 기억해야 할 핵심 요약

서버는 두지 않음. GitHub Private Repo가 백엔드, Cloudflare Pages가 배포처임.

폰은 읽기 + inbox 쓰기만. 기존 파일 수정은 절대 금지임.

AI 채팅은 claude.ai 위임. 자체 채팅 UI 만들지 않음.

디자인은 로컬 핸드오프 자산이 진실의 원천임. URL은 백업임. v4의 URL 의존을 v5에서 역전시킴.

테마는 3옵션임: 라이트, 다크, 시스템 자동. Ant Design 팔레트는 참조용일 뿐 테마 아님.

Liquid Glass 전면 수용. Brief의 차분함 원칙과 충돌 안 함. iOS 26 네이티브 정합성까지 얻음.

CalendarView는 Claude Design이 준 통찰임. Phase 1에 M3.5로 편입됨. 총 11화면 체계임.

번들 직접 매핑 3화면(HomeView, SlateDetail, CalendarView) + 파생 구현 8화면 = 총 11화면임.

총 공수 10~11일, Claude Code 활용 시 5~6일. CalendarView 반나절 추가됐지만 가치 큼.

v5가 v4를 덮어쓰지 않음. 참조용으로 v4도 docs/에 남김. Git history와 파일명 버전 이중 관리임.
