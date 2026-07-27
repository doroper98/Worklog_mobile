# Workwiki Mobile 개선 계획 v1 — 주간보고 열람 · 슬레이트 왕복 · 테마 이식

> **문서 용도.** 이 저장소(Workwiki Mobile)와 데스크탑 본체(Workwiki)를 실제로 읽고
> 대조한 결과를 근거로, 세 가지 개선 과제의 설계와 구현 순서를 정의한다.
>
> **작성 기준일.** 2026-07-27
> **분석 대상 버전.** 모바일 `main@40f34bc` (2026-05-29) / 데스크탑 v3.41.x
> **권위 순서.** CLAUDE.md > 이 문서 > SPEC v5 > Design Brief v2
> **이 문서의 지위.** SPEC v5를 대체하지 않는다. SPEC v5의 Phase 4를 구체화하고
> Phase 7(주간보고 열람)·Phase 8(테마 확장)을 신설하는 증분 명세다.

---

## 0. Executive Summary

세 가지 요구가 있었다.

1. 데스크탑에서 작성한 **주간 레포트를 모바일에서 보고 싶다.**
2. 모바일에서 작성한 **슬레이트를 데스크탑에서도 보고 싶다.**
3. 데스크탑에 적용된 **테마들을 모바일에도 적용하고 싶다.**

조사 결과 세 요구의 난이도는 서로 크게 다르다.

| 과제 | 난이도 | 이유 |
|------|--------|------|
| **A. 주간보고 열람** | 낮음 | 데이터는 **이미 저장소에 올라가 있다.** 모바일에 읽는 UI가 없을 뿐이다. 모바일 단독 작업. |
| **B. 슬레이트 왕복** | 높음 | 데스크탑 쪽 소비자가 **아예 없다.** 모바일이 쓴 파일은 저장소에 도착만 하고 아무도 읽지 않는다. 양쪽 저장소 동시 작업 + 동기화 방향 문제. |
| **C. 테마 이식** | 중간 | 양쪽 토큰 체계가 다르다(`--yk-*` vs `--color-*`). 순수 CSS 매핑 + 파생 규칙 문제. 모바일 단독 작업. |

권고 순서는 **A → C → B**다. A는 반나절이면 눈에 보이는 성과가 나고, C는 A와 독립이며,
B는 데스크탑 저장소 작업이 필수라 별도 세션이 필요하다.

---

## 1. 현황 분석 — 조사로 확인한 사실

추정이 아니라 실제 파일을 읽어 확인한 내용만 적는다.

### 1.1 데이터 저장소와 앱 데이터 루트는 같은 폴더다

데스크탑의 데이터 루트가 곧 이 저장소의 데이터 저장소다.

```
데스크탑 dataRoot (getDataRoot())  ==  데이터 저장소 작업 트리
  └── .git → origin = 데이터 저장소 (Private)
```

즉 데스크탑이 파일을 쓰면 그 자리가 곧 Git 작업 트리이고, 자동 푸시가 그대로 원격에 올린다.
별도의 export/sync 단계가 없다. 이것이 개선 설계의 가장 중요한 전제다.

**추적 중인 최상위 경로(실측):**

```
config/  inbox/  journals/  markdown/  reports/  wiki/  meta-index.json  CLAUDE.md  AGENTS.md
```

`reports/`와 `inbox/`가 **이미 추적 대상**이라는 점이 핵심이다.

### 1.2 자동 동기화는 단방향(push)이다

데스크탑 `auto-push-service.ts`:

- 50~70분 랜덤 간격으로 `commitAndPush()` 1회.
- `clean && ahead === 0`이면 네트워크 호출조차 건너뛴다.
- **`pull`은 호출하지 않는다.** `pullRebase()`는 push가 non-fast-forward로 실패했을 때만 방어적으로 돈다.

결과: 모바일이 원격에 파일을 추가해도 데스크탑은 **다음에 자신이 push를 시도해 거부당할 때까지** 그 존재를 모른다.
그리고 데스크탑이 로컬에서 아무 것도 안 바꿨다면 push 시도 자체가 skip되므로, 영영 모를 수도 있다.
과제 B는 이 비대칭을 반드시 해소해야 한다.

### 1.3 주간 레포트는 이미 원격에 있다 — 모바일에 UI만 없다

데스크탑 `data-service.ts`의 `saveWeeklyReport()`는 `reports/{id}.json`에 저장한다.
`WeeklyReportPanel.tsx`가 만드는 id 형식은 다음과 같다.

```
{dateFrom}_{dateTo}_{Date.now()}
예) 2026-06-10_2026-06-20_1781832115259.json
```

**실측 스키마(실제 파일 확인):**

```json
{
  "id": "2026-04-09_2026-04-23_1776396571905",
  "createdAt": "2026-04-17T03:29:31.905Z",
  "dateFrom": "2026-04-09",
  "dateTo": "2026-04-23",
  "content": "[프로젝트 A]\n- ... (04/09)\n- ... (04/13)\n\n[프로젝트 B]\n- ...\n"
}
```

`content`는 마크다운 겸 평문이다. 대괄호 헤더로 프로젝트를 묶고, 각 줄 끝에 `(MM/DD)` 또는 `(~MM/DD)`로
완료일·기한을 붙인다. 렌더링은 일반 마크다운 렌더러로 충분하되, 대괄호 헤더는 문단으로 떨어지므로
**전용 파서로 섹션화하면 가독성이 크게 좋아진다**(§2.4).

또한 저장 시 위키에도 동시에 기록된다.

```
wiki/notes/weekly-{from}-to-{to}.md
```

따라서 **모바일은 이미 Wiki > Notes 카테고리에서 주간보고를 볼 수는 있다.** 다만
notes에 다른 문서들과 뒤섞여 있어 존재를 알기 어렵고, 기간·최신순 정렬도 없다.
이것이 "주간보고를 못 본다"는 체감의 실제 원인이다.

**주의점.** `reports/` 폴더는 순수하지 않다. 실측 결과 주간보고 JSON 외에 `.pptx`, `.md`, `.jpg`, `.js`가
섞여 있다(사용자가 산출물 보관용으로도 쓰는 폴더). 모바일은 **파일명 패턴으로 엄격히 필터**해야 한다.

```
^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_\d+\.json$
```

### 1.4 모바일이 쓴 메모를 데스크탑은 읽지 않는다

데스크탑 소스 전체(`src/`)에서 `inbox` 문자열 검색 결과 **0건**이다.
SPEC v5의 Phase 4(SC-15~18, `InboxService`·`InboxPanel`)는 **미구현**이다.

한편 모바일은 이미 쓰고 있었다. 실측 결과 2건이 로컬 데이터 루트에 도착해 있다.

```
inbox/2026/04/29-203313-agent-work가-뭐지.md   (140 B)
inbox/2026/05/20-143715-cdn-bom.md            (59,998 B)
```

내용은 `InboxWriter.ts`가 만드는 프론트매터 그대로다.

```markdown
---
source: mobile
created_at: 2026-04-29T20:33:13.742+09:00
device: iPhone (iOS 18.7)
tags: [quick-memo]
---

본문
```

즉 배관은 이미 뚫려 있고 **수신부만 없다.** 과제 B는 새 파이프라인을 만드는 일이 아니라
끊긴 끝단을 잇는 일이다.

### 1.5 모바일이 현재 읽는 것 / 쓰는 것

| 대상 | 경로 | 담당 |
|------|------|------|
| 위키 4카테고리 | `wiki/{people,projects,issues,notes}/*.md` | `useWikiTree.ts` (재귀 트리 1회) |
| 저널(슬레이트) | `journals/YYYY/MM/DD.json` | `CalendarService.getSlatesForDay()` |
| Daily MD | 저널 JSON의 최상위 `markdown` 필드 | 동상, 특수 슬레이트로 prepend |
| Follow-up | `config/followups.json` | `CalendarService.fetchFollowups()` |
| 메타 인덱스 | `meta-index.json` | `useMetaIndex.ts` |
| 이미지 | Contents API 바이너리 | `GitHubImage.tsx` |
| **쓰기** | `inbox/**` **한정** | `GitHubClient.putContents()` — 타입(`InboxPath`) + 런타임 이중 가드 |
| **못 읽는 것** | **`reports/**`** | — |

`GitHubClient.getLatestCommitSha(branch = 'master')`의 기본값이 `master`인 점을 확인해 두었다.
데이터 저장소의 기본 브랜치가 `main`으로 바뀌면 위키 트리 전체가 조용히 실패하므로,
과제 A 작업 시 함께 점검할 것을 권한다.

### 1.6 테마 체계 대조

| | 데스크탑 | 모바일 |
|---|---|---|
| 변수 접두 | `--yk-*` | `--color-*`, `--glass-*` |
| 정의 위치 | `index.html` `:root`(라이트) + `[data-theme="dark"]`, `styles/themes.css`(8종) | `styles/tokens.css` |
| 테마 수 | **10종** (라이트 + 다크 + CYPRUS·NOTURNO·BRIDAL·COSMOS·LAUREL·PRINCESS·STEEL·NAVY) | **2종** (라이트 + 다크) + 시스템 자동 |
| 영속 키 | `localStorage['workwiki-theme']` | `localStorage['theme']` |
| 적용 방식 | `<html data-theme>` + FOUC 방지 인라인 스크립트 | `<html data-theme>` (useTheme의 `useEffect`) |
| 파생 방식 | 팔레트 4색(primary/bg/surface/text)에서 `color-mix`로 나머지 도출 | 토큰을 전부 명시 |
| 특수 | — | **Liquid Glass** (`--glass-*` 8종, 성능 티어 3단계) |

데스크탑 8종은 모두 **어두운 배경 + 밝은 텍스트** 계열이고, 각 테마가 명시하는 원본 색은 실질적으로
**primary / bg / bg-secondary / surface / text** 5개뿐이다. 나머지는 전부 `color-mix` 파생이다.
이 구조 덕분에 모바일 이식은 "5색만 옮기고 파생 규칙을 모바일 토큰 체계로 다시 쓰는" 문제로 축소된다(§4).

모바일에는 데스크탑에 없는 `--glass-*` 계열이 있어 **테마별 유리 틴트를 새로 도출**해야 한다.
이것이 이식 작업의 실질적 난점이다.

---

## 2. 과제 A — 주간 레포트 모바일 열람

### 2.1 목표

홈에서 두 번 안에 최신 주간보고에 도달한다. 과거 보고는 기간 역순 목록으로 탐색한다.

### 2.2 접근 방식 선택

| 안 | 내용 | 평가 |
|----|------|------|
| A-1 | `reports/` 디렉토리를 직접 조회해 JSON을 읽는다 | **채택.** 원본 데이터. 기간 메타(dateFrom/dateTo/createdAt)가 구조화되어 있어 정렬·필터가 정확하다. |
| A-2 | `wiki/notes/weekly-*.md`만 필터해 보여준다 | 보조. 구현이 더 싸지만 파일명 파싱에만 의존하고 `createdAt`이 없다. |
| A-3 | 데스크탑이 `reports/index.json`을 생성하고 모바일은 그것만 읽는다 | 나중에. API 호출 1회로 줄지만 데스크탑 변경이 필요하다. |

**결정: A-1을 기본, A-2를 폴백으로 병합한다.** 두 소스를 `dateFrom` 기준으로 dedupe하고,
JSON이 있으면 JSON을 우선한다. 이렇게 하면 데스크탑을 건드리지 않고도 과거 자료 누락이 없다.

### 2.3 신규 파일

```
src/services/ReportsService.ts      신규
src/hooks/useReports.ts             신규
src/components/ReportsView.tsx      신규   (목록)
src/components/ReportDetailView.tsx 신규   (본문)
```

**ReportsService 계약:**

```typescript
export interface WeeklyReport {
  id: string
  dateFrom: string      // YYYY-MM-DD
  dateTo: string        // YYYY-MM-DD
  createdAt: string     // ISO
  content: string       // 마크다운 겸 평문
  source: 'reports' | 'wiki-notes'
}

export interface ReportSummary {
  id: string
  dateFrom: string
  dateTo: string
  createdAt: string
  path: string
  source: 'reports' | 'wiki-notes'
  /** content 첫 유효 줄 (목록 프리뷰용). 목록 단계에서는 비어 있을 수 있다. */
  preview?: string
}

export const ReportsService = {
  listReports(): Promise<ReportSummary[]>            // 최신순 정렬
  getReport(summary: ReportSummary): Promise<WeeklyReport>
  clearCache(): void
}
```

**구현 규칙**

- 목록은 `getContents('reports')` **1회**. 개별 파일을 열지 않는다. 파일명만으로
  `id`/`dateFrom`/`dateTo`/타임스탬프를 전부 복원할 수 있다.
- 위키 폴백은 이미 받아 둔 재귀 트리를 재사용한다(`useWikiTree`가 쓰는 것과 동일한 트리).
  **추가 API 호출 0회**로 `wiki/notes/weekly-*.md`를 걸러낼 수 있다.
- 상세는 탭 시점에 1회 fetch. `CalendarService`와 동일하게 1 MB 초과 시 Blob API 폴백.
- 캐시 TTL은 `CalendarService`의 `CACHE_TTL`(5분)과 동일하게 맞춘다. 상수를 공용 모듈로 뽑을 것.
- `refreshCaches.ts`의 `clearAllCaches()`에 `ReportsService.clearCache()`를 등록한다.
  등록하지 않으면 당겨서 새로고침이 보고서만 갱신하지 않는 버그가 된다.

**실패 모드**

| 상황 | 처리 |
|------|------|
| `reports/` 404 | 빈 목록. 에러 배너 금지(폴더가 없을 수도 있다) |
| 파일명 패턴 불일치 | 조용히 제외. 이 폴더에는 무관 파일이 섞여 있다(§1.3) |
| JSON 파싱 실패 | 해당 항목만 제외하고 목록은 표시 |
| 오프라인 | 캐시된 목록/본문 표시 + 기존 `OfflineBanner` 재사용 |

### 2.4 렌더링 — 대괄호 섹션 파서

`content`는 다음 형태다.

```
[프로젝트 A]
- 항목 (04/09)
- 항목 (~04/23)

[프로젝트 B]
- 항목 (04/16)
```

일반 마크다운으로 넘기면 `[프로젝트 A]`가 그냥 한 줄 문단이 되어 계층이 보이지 않는다.
**전처리로 섹션을 만든다.**

```typescript
/** 줄 시작의 [헤더]를 접을 수 있는 섹션으로 변환한다. */
function parseReportSections(content: string): { title: string; items: string[] }[]
```

- 각 섹션은 기본 펼침, 헤더 탭으로 접기. 모바일에서 5~8개 프로젝트를 훑기에 이 편이 낫다.
- 줄 끝 `(MM/DD)`는 우측 정렬 날짜 배지로 분리한다.
- `(~MM/DD)`(기한/미완료)는 `--color-warning` 계열로 구분한다. 완료분과 예정분을 눈으로 가르는 것이
  주간보고를 폰에서 볼 때의 실질적 효용이다.
- 파싱에 실패하거나 대괄호 헤더가 하나도 없으면 **기존 `MarkdownView`로 그대로 폴백**한다.
  위키 폴백 소스(`weekly-*.md`)는 앞에 제목·작성일 헤더가 붙으므로 이 경로를 탄다.

### 2.5 진입 동선

1. **홈 상단.** 위키 카테고리 그리드 위 또는 옆에 "주간보고" 카드 1장.
   최신 보고의 기간(`06.12–06.20`)을 부제로 노출한다. 안 읽은 최신본이 있으면 점 표시.
2. **탭 바.** 현재 4탭(홈/달력/보낸 메모/설정)이다. 5탭은 폭이 좁아진다.
   → 탭 추가 대신 **홈 카드 + 설정 하위 진입**을 권한다.
3. **딥링크.** `ReportDetailView`에 기존 Bridge to Claude 버튼을 그대로 붙인다.
   "이번 주 보고 요약해줘"가 폰에서 바로 된다. 이게 은근히 큰 가치다.

### 2.6 데스크탑 측 선택 개선(권장, 필수 아님)

`reports/index.json`을 데스크탑이 갱신하면 모바일 목록이 API 1회로 끝나고 프리뷰도 즉시 나온다.

```jsonc
// reports/index.json
{
  "updatedAt": "2026-07-27T…",
  "reports": [
    { "id": "…", "dateFrom": "…", "dateTo": "…", "createdAt": "…", "preview": "첫 줄" }
  ]
}
```

`data-service.ts`의 `saveWeeklyReport()`/`deleteWeeklyReport()`에서 함께 갱신하면 된다.
모바일은 index가 있으면 쓰고 없으면 디렉토리 스캔으로 폴백하도록 짠다. **index 없이도 동작해야 한다.**

### 2.7 수용 기준

- **SC-38.** 홈에서 주간보고 목록에 1탭으로 진입한다.
- **SC-39.** 목록이 기간 역순으로 정렬되고, 각 항목에 `YYYY.MM.DD–MM.DD`가 보인다.
- **SC-40.** 항목 탭 시 본문이 프로젝트 섹션으로 구분되어 렌더링된다.
- **SC-41.** `reports/`의 비-보고서 파일(pptx/jpg/md 등)이 목록에 나타나지 않는다.
- **SC-42.** 기내 모드에서 한 번 연 보고서가 다시 열린다.
- **SC-43.** 목록 로딩에 소비되는 GitHub API 호출이 2회 이하다.

---

## 3. 과제 B — 모바일 슬레이트를 데스크탑에서 보기

### 3.1 무엇이 문제인가

모바일 `QuickMemoSheet`은 자유 텍스트를 `inbox/`에 던진다. 데스크탑에는 그것을 읽는 코드가 없다(§1.4).
따라서 두 가지를 동시에 해결해야 한다.

1. **표현력.** 지금 inbox 메모에는 "이건 회의 슬레이트다", "6/20자 항목이다" 같은 정보가 없다.
2. **수신.** 데스크탑이 원격을 당겨오고, 파일을 읽고, 저널에 반영하고, 처리 완료를 표시해야 한다.

### 3.2 설계 갈림길 — 모바일이 저널을 직접 쓸 것인가

| | B-α: 모바일이 `journals/**.json` 직접 수정 | B-β: inbox 경유 + 데스크탑이 승격 |
|---|---|---|
| 데스크탑 앱 없이 반영 | 즉시 | 데스크탑 실행 시 |
| 충돌 위험 | **높음.** 같은 날 파일을 양쪽이 각자 쓰면 마지막 쓰기가 이긴다. 데스크탑은 파일 단위로 통째 덮어쓴다(`saveJournalV3`) | 낮음. 모바일은 새 파일만 만든다 |
| 데이터 손상 | **가능.** 하루치 슬레이트 전부 유실 시나리오 존재 | 구조적으로 불가 |
| 기존 원칙 | SPEC v5 §3, CLAUDE.md §6.1의 **명시적 금지사항 위반** | 원칙 유지 |
| 마크다운/위키/메타 인덱스 갱신 | 못 함(LLM 파이프라인이 데스크탑에 있음) | 승격 시점에 기존 파이프라인이 그대로 돈다 |

**결정: B-β를 채택한다.** α는 즉시성 하나를 얻고 데이터 무결성과 기존 아키텍처 원칙 전부를 잃는다.
데스크탑을 매일 켜는 사용 패턴에서 α의 이점은 실질적으로 없다.

다만 β의 체감 지연("폰에서 쓴 게 언제 반영되지?")은 §3.5의 자동 pull과 §3.7의 왕복 신호로 해소한다.

### 3.3 inbox 스키마 v2 — 슬레이트를 표현할 수 있게

기존 v1(§1.4)과 **하위 호환**을 유지한다. `kind`가 없으면 v1 quick-memo로 간주한다.

```markdown
---
source: mobile
schema: 2
created_at: 2026-07-27T14:23:05+09:00
device: iPhone (iOS 18.7)
kind: meeting          # meeting | task | memo | followup | append
title: 주간 설계 리뷰
target_date: 2026-07-27   # 이 슬레이트가 귀속될 날짜 (기본: 작성일 KST)
attendees: [홍길동, 김철수]  # kind=meeting일 때만
target_slate_id: slate-…    # kind=append일 때만 — 기존 슬레이트에 이어붙이기
tags: [mobile]
---

본문 마크다운
```

**필드 규칙**

- `target_date`는 **사용자가 바꿀 수 있어야 한다.** 퇴근길에 오늘 회의를 정리하는 것과
  내일 할 일을 적어두는 것은 다르다. 기본값은 KST 오늘.
- `kind: append`는 기존 슬레이트에 문단을 덧붙인다. 데스크탑의 `resolveSlateRef()`가
  id뿐 아니라 제목 퍼지 매칭까지 지원하므로, 모바일은 정확한 id를 몰라도 제목만 보내면 된다.
- 파일명 규칙은 유지하되 kind를 접두로 넣어 데스크탑 스캔 비용을 줄인다.
  `inbox/YYYY/MM/DD-HHMMSS-{kind}-{slug}.md`
  (v1 파일명도 계속 파싱 가능해야 한다 — 이미 저장소에 2건 있다.)

### 3.4 모바일 측 변경

```
src/components/QuickMemoSheet.tsx    확장  (유형 선택 · 제목 · 날짜 · 참석자)
src/services/InboxWriter.ts          확장  (스키마 v2 직렬화)
src/components/InboxSentView.tsx     신규  (탭 바 '보낸 메모'가 아직 뷰가 없다)
src/services/InboxStatusService.ts   신규  (처리 상태 조회 — §3.7)
```

**QuickMemoSheet UI 원칙**

- 기본 화면은 지금과 똑같이 유지한다. 빠른 메모가 가장 흔한 경로이므로 **한 줄도 더 요구하지 않는다.**
- 상단에 유형 칩(메모/회의/할일/이어쓰기) 한 줄만 추가한다. 메모 이외를 고르면 그때 제목·날짜 필드가 펼쳐진다.
- 유형별 필수 필드: 회의 = 제목, 할일 = 제목, 이어쓰기 = 대상 슬레이트(오늘/최근 목록에서 선택).
- 오프라인이면 IndexedDB `pending_memos`에 큐잉(SPEC v5 §6.3에 이미 명세됨, 미구현).

**중요.** 현 탭 바에는 `inbox`('보낸 메모') 항목이 있으나 `App.tsx`의 `handleTabSelect`가
`calendar`/`settings` 외에는 전부 홈으로 보낸다. 즉 **'보낸 메모' 탭은 지금 눌러도 홈으로 간다.**
과제 B에서 이 뷰를 실제로 만들어야 한다.

### 3.5 데스크탑 측 변경 — 여기가 본체다

이 작업은 **데스크탑 저장소에서 별도 세션으로** 진행한다(CLAUDE.md §8).

```
src/main/services/inbox-service.ts       신규
src/main/services/auto-push-service.ts   개편 → auto-sync (pull 추가)
src/renderer/components/panel/InboxPanel.tsx  신규
src/renderer/components/layout/StatusBar.tsx  배지 추가
src/renderer/components/panel/SidePanel.tsx   아이콘 추가
```

**InboxService 계약**

```typescript
interface InboxItem {
  path: string            // inbox/YYYY/MM/DD-HHMMSS-kind-slug.md
  schema: 1 | 2
  kind: 'meeting' | 'task' | 'memo' | 'followup' | 'append'
  title: string
  targetDate: string      // YYYY-MM-DD
  body: string
  attendees?: string[]
  targetSlateId?: string
  createdAt: string
  device: string
}

interface InboxService {
  scan(): Promise<InboxItem[]>                  // 미처리 항목만
  promote(item: InboxItem): Promise<PromoteResult>   // 저널에 슬레이트로 편입
  appendTo(item: InboxItem): Promise<PromoteResult>  // 기존 슬레이트에 덧붙임
  discard(item: InboxItem): Promise<void>            // 처리 없이 보관 이동
  markProcessed(item: InboxItem, result): Promise<void>
}
```

**promote 절차**

1. `dataService.loadJournalV3(targetDate)` — 없으면 `{version:3, date, slates:[]}` 생성.
2. `WorkSlate` 조립: `id = 'slate-' + createdAt 기반`, `type`, `title`, `content`(본문),
   `createdAt`/`updatedAt`은 **모바일 작성 시각을 보존**한다(승격 시각이 아니다).
3. `slates`에 append 후 `saveJournalV3()`.
4. 처리 표시(§3.6) 후 `git-service.commitAndPush()`로 원격 반영.
5. 마크다운 생성/위키 ingest는 **자동으로 돌리지 않는다.** 사용자가 데스크탑에서 평소처럼
   생성 버튼을 누르면 기존 파이프라인이 그대로 탄다. 승격 단계에서 LLM을 강제하면
   비용·대기·오생성 위험만 늘고 얻는 게 없다.

**auto-sync 개편**

현행 `runOnce()`의 `clean && ahead === 0 → skip` 분기 때문에 **모바일 변경이 영영 감지되지 않을 수 있다.**
다음으로 바꾼다.

```
매 사이클:
  1. fetch origin                      (항상)
  2. behind > 0 이면 pull --rebase     (신규)
  3. 로컬 변경 있으면 commit + push     (기존)
  4. pull로 inbox/ 아래 새 파일이 들어왔으면 → renderer 로 이벤트 발송 → 배지 점등
```

주기는 현행 50~70분이 그대로면 "폰에서 쓴 게 한 시간 뒤에 뜬다"가 되어 체감이 나쁘다.
**앱 시작 직후 1회 + 창 포커스 복귀 시 throttle(5분) 1회**를 추가하면 대부분의 실사용에서 즉시 반영된다.
pull은 변경 없으면 매우 싸므로 부담이 없다.

**rebase 충돌.** 모바일은 새 파일만 만들고 데스크탑은 기존 파일을 고치므로 같은 파일을 양쪽이
건드릴 일이 사실상 없다. 그래도 `pullRebase()`의 기존 abort 경로를 그대로 재사용해 안전하게 처리한다.

### 3.6 처리 완료 표시 — 파일 이동 대 마커

| 안 | 장점 | 단점 |
|----|------|------|
| **B-i. `inbox/_processed/` 로 이동** | 스캔이 항상 빠름(미처리만 남음). 상태가 자명 | 모바일이 자기 메모를 다시 찾으려면 두 곳을 봐야 함 |
| B-ii. 프론트매터에 `processed_at` 추가 | 파일 위치 불변 | 데스크탑이 모바일이 만든 파일을 **수정**하게 됨. 매 스캔이 전수 파싱 |
| B-iii. `inbox/_state.json` 인덱스 | 원본 불변 + 스캔 저렴 | 인덱스와 실제가 어긋날 여지 |

**결정: B-i + 얇은 B-iii.** 파일은 `inbox/_processed/YYYY/MM/`으로 옮기고,
동시에 `inbox/_state.json`에 처리 결과 한 줄을 남긴다.

```jsonc
// inbox/_state.json
{
  "processed": [
    {
      "originalPath": "inbox/2026/07/27-142305-meeting-주간설계리뷰.md",
      "processedAt": "2026-07-27T15:02:11+09:00",
      "action": "promote",              // promote | append | discard
      "journalDate": "2026-07-27",
      "slateId": "slate-…"
    }
  ]
}
```

모바일은 이 파일 **하나만** 읽으면 자기가 보낸 메모가 어떻게 됐는지 전부 안다(API 1회).

### 3.7 왕복 완성 — 모바일에서 결과 보기

`InboxSentView`는 두 소스를 합쳐 보여준다.

1. 로컬 IndexedDB `sent_memos` — 내가 보낸 것(오프라인에서도 보임)
2. 원격 `inbox/_state.json` — 처리 결과

상태 표시:

| 상태 | 조건 | 표시 |
|------|------|------|
| 전송됨 | 커밋 성공, `_state.json`에 없음 | 회색 점 |
| 반영됨 | `_state.json`에 `promote`/`append` | 초록 체크 + "7/27 일지에 반영" |
| 보류됨 | `_state.json`에 `discard` | 회색 취소선 |
| 대기 중 | 오프라인 큐 | 노란 점 + 재시도 버튼 |

**반영됨 항목을 탭하면 해당 날짜 슬레이트로 이동한다.** 여기서 왕복이 닫힌다.
"폰에서 쓴 슬레이트를 데스크탑에서 본다"는 요구는, 폰에서도 그것이 데스크탑에 반영됐음을
확인할 수 있을 때 비로소 완성된다.

### 3.8 수용 기준

- **SC-44.** 모바일에서 유형·제목·날짜를 지정해 슬레이트를 보낼 수 있다.
- **SC-45.** 데스크탑이 앱 시작 5분 이내에 새 inbox 항목을 감지하고 배지를 띄운다.
- **SC-46.** 승격 시 해당 날짜 저널에 슬레이트가 추가되고, 기존 슬레이트가 유실되지 않는다.
- **SC-47.** 승격된 슬레이트의 작성 시각이 **모바일 작성 시각**으로 보존된다.
- **SC-48.** 처리된 항목은 재스캔에서 다시 나타나지 않는다.
- **SC-49.** 모바일 '보낸 메모'에서 반영 여부가 확인되고, 탭하면 해당 슬레이트로 이동한다.
- **SC-50.** v1 스키마(기존 2건)도 오류 없이 스캔·승격된다.
- **SC-51.** 모바일은 여전히 `inbox/` 외 경로에 쓰지 못한다(타입 + 런타임 가드 유지).

---

## 4. 과제 C — 데스크탑 테마 8종을 모바일에 이식

### 4.1 목표

설정에서 데스크탑과 같은 테마를 고를 수 있다. Liquid Glass가 모든 테마에서 자연스럽게 동작한다.

### 4.2 왜 단순 복사가 안 되는가

세 가지 이유다.

1. **변수 이름이 다르다.** 데스크탑 `--yk-bg`, 모바일 `--color-bg`.
2. **모바일에만 있는 토큰이 있다.** `--glass-bg`, `--glass-border`, `--glass-shadow`, `--scrim`,
   `--color-meet/task/memo/personal/daily`(슬레이트 유형색), `--color-skel*`(스켈레톤).
   8종 테마는 이 값들을 **정의하지 않는다.** 파생 규칙이 필요하다.
3. **데스크탑 다크 테마의 `--yk-bg`는 그라디언트다**(`linear-gradient(45deg, …)`).
   모바일은 `background-color`에 넣는 자리가 많아 그대로 옮기면 깨진다. 단색으로 눌러야 한다.

### 4.3 이식 전략 — 원본 5색 + 파생 규칙

각 테마가 실제로 정의하는 것은 5색뿐이다(§1.6). 이것만 옮기고 나머지는 모바일 규칙으로 만든다.

```typescript
// 팔레트 단일 소스 (예: src/styles/palettes.ts 또는 빌드 타임 JSON)
interface Palette {
  key: string          // 'cyprus' | 'noturno' | …
  label: string        // '사이프러스'
  mode: 'light' | 'dark'   // 텍스트/유리 파생 방향 결정
  primary: string
  bg: string
  bg2: string
  surface: string
  text: string
}
```

**파생 규칙(다크 계열 기준):**

| 모바일 토큰 | 도출식 |
|---|---|
| `--color-bg` | `bg` |
| `--color-bg2` | `bg2` |
| `--color-surface` | `surface` |
| `--color-surface-alt` | `color-mix(in srgb, surface 92%, text)` |
| `--color-surface-warm` | `color-mix(in srgb, surface 88%, primary)` |
| `--color-text` | `text` |
| `--color-text-sec` | `color-mix(in srgb, text 70%, transparent)` |
| `--color-text-muted` | `color-mix(in srgb, text 48%, transparent)` |
| `--color-text-faint` | `color-mix(in srgb, text 30%, transparent)` |
| `--color-border` | `color-mix(in srgb, text 10%, transparent)` |
| `--color-border-strong` | `color-mix(in srgb, text 18%, transparent)` |
| `--color-hairline` | `color-mix(in srgb, text 6%, transparent)` |
| `--color-accent` | `primary` |
| `--color-accent-hover` | `color-mix(in srgb, primary 85%, text)` |
| `--color-accent-soft` | `color-mix(in srgb, primary 14%, transparent)` |
| `--color-accent-faint` | `color-mix(in srgb, primary 22%, transparent)` |
| `--color-accent-text-on` | 명도 대비로 결정 — §4.5 |
| `--color-skel` / `--color-skel2` | `text` 8% / 4% |
| **`--glass-bg`** | `color-mix(in srgb, bg 68%, transparent)` |
| **`--glass-bg-sheet`** | `color-mix(in srgb, surface 85%, transparent)` |
| **`--glass-highlight`** | `color-mix(in srgb, text 10%, transparent)` |
| **`--glass-border`** | `color-mix(in srgb, text 12%, transparent)` |
| **`--scrim`** | `rgba(0,0,0,0.55)` (다크) / `color-mix(in srgb, text 38%, transparent)` (라이트) |
| `--bg-opaque` | `bg` (그라디언트면 첫 stop 색) |

`--glass-*`를 **테마 배경에서 파생시키는 것**이 이 이식의 핵심이다.
라이트 테마의 흰 틴트를 짙은 배경 테마에 그대로 쓰면 유리가 뿌옇게 뜨고 텍스트 대비가 무너진다.

**슬레이트 유형색**(`--color-meet/task/memo/personal/daily`)은 파생이 어렵다.
색상환에서 primary 기준 회전으로 만들면 테마마다 의미색이 달라져 오히려 혼란스럽다.
→ **다크 계열 8종은 현행 다크 테마의 유형색 5개를 공용으로 상속**하고,
배경 대비가 부족한 테마(예: BRIDAL의 자주 배경 위 `#F7768E`)만 개별 오버라이드한다.

### 4.4 구현 파일

```
src/styles/palettes.ts        신규   팔레트 5색 정의 (단일 소스)
src/styles/themes-extra.css   신규   [data-theme="cyprus"] … 8블록 (생성물)
scripts/gen-themes.mjs        신규   palettes.ts → themes-extra.css 생성
src/hooks/useTheme.ts         수정   ThemeSetting 타입 확장
src/types.ts                  수정   ThemeSetting = 'system' | 'light' | 'dark' | ThemeKey
src/components/SettingsView.tsx 수정 테마 목록 + 색상 스와치
index.html                    수정   FOUC 방지 인라인 스크립트
public/manifest.webmanifest   수정   theme_color 동기화(§4.6)
```

데스크탑도 `gen-themes.js`로 CSS를 생성하고 있다(themes.css 헤더에 명시). **같은 방식을 유지한다.**
손으로 8×30줄을 관리하면 반드시 어긋난다.

### 4.5 접근성 검증 — 건너뛰지 말 것

8종은 전부 채도 높은 유색 배경이다. 실측 팔레트 중 위험한 조합이 있다.

- **LAUREL:** `primary #B1B7AB`(연회색) 위에 흰 텍스트 → 대비 부족 가능.
- **BRIDAL:** `primary #FFB38F`(살구) — 이 위에 놓일 `--color-accent-text-on`은 반드시 **어두운 색**이어야 한다.
- **PRINCESS:** `bg #015AA0` — 파랑 배경 위 파랑 계열 링크가 묻힌다.

따라서 `--color-accent-text-on`은 고정값이 아니라 **상대 휘도로 결정**한다.

```typescript
/** WCAG 상대 휘도 기준으로 accent 위 텍스트 색을 고른다. */
function onColor(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? '#1A1B26' : '#FFFFFF'
}
```

생성 스크립트에 **대비비 검사**를 넣고, 본문 텍스트 4.5:1 / 큰 텍스트 3:1 미만이면
빌드를 실패시키는 대신 경고를 출력하고 해당 테마의 `text`를 자동 보정한다.

### 4.6 모바일 고유 고려사항

데스크탑에는 없고 모바일에만 있는 것들이다. 빼먹으면 티가 크게 난다.

1. **FOUC.** 현재 `useTheme`의 `useEffect`에서 `data-theme`을 붙인다. 첫 페인트가 라이트로 나갔다가
   바뀌는 깜빡임이 있다. 데스크탑처럼 `index.html`에 인라인 스크립트를 넣어 선반영한다.
   ```html
   <script>try{var t=localStorage.getItem('theme');
   if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
   ```
2. **`theme-color` 메타.** iOS standalone에서 상단 상태바 색이 이 값을 따른다.
   테마 변경 시 `<meta name="theme-color">`를 **런타임에 갱신**하지 않으면 상태바만 이전 테마로 남는다.
   ```typescript
   document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bgOf(theme))
   ```
3. **`manifest.webmanifest`의 `background_color`.** 스플래시 색이다. 정적이므로 기본 테마 기준으로 두되,
   다크 계열 테마를 상시 쓴다면 그 값으로 바꾸는 편이 스플래시 → 앱 전환이 매끄럽다.
4. **시스템 자동과의 관계.** `system`은 라이트/다크만 오간다. 8종 중 하나를 고르면
   시스템 설정과 무관하게 고정된다. 설정 UI에서 이 점을 한 줄로 안내한다.
   구조: `{ mode: 'system' | 'fixed', theme: ThemeKey }`로 두는 편이 명확하지만,
   기존 `localStorage['theme']` 단일 문자열과의 호환을 위해 **값 집합만 확장**하는 쪽을 권한다.
5. **테마 전환 트랜지션.** `themes.css`가 `html *`에 0.2s 트랜지션을 건다. 8종 전환 시
   전체 리페인트가 무거울 수 있다. 전환 순간에만 트랜지션을 끄는 클래스를 잠시 붙이는 방법을 검토한다.

### 4.7 장기 — 팔레트 단일 소스화

지금은 데스크탑 `themes.css`와 모바일 `themes-extra.css`가 **각자의 진실**을 갖는다.
색 하나를 바꾸면 두 곳을 고쳐야 하고, 반드시 어긋난다.

권장: 데이터 저장소에 `config/themes.json`을 두고 양쪽이 각자의 생성 스크립트로 CSS를 만든다.
데스크탑은 이미 데이터 루트를 읽고, 모바일은 이미 `config/followups.json`을 읽고 있으므로
**추가 인프라가 필요 없다.** 모바일이 런타임에 팔레트를 읽으면 앱 재배포 없이 테마가 늘어난다.

이건 A·B·C가 다 끝난 뒤의 개선이다. 지금 하면 과제 C가 불필요하게 커진다.

### 4.8 수용 기준

- **SC-52.** 설정에서 데스크탑과 동일한 8종 + 라이트/다크/시스템을 고를 수 있다.
- **SC-53.** 각 테마에서 Liquid Glass 표면이 배경색과 조화된 틴트로 렌더링된다.
- **SC-54.** 앱 재시작 시 선택 테마가 **깜빡임 없이** 첫 페인트부터 적용된다.
- **SC-55.** iOS standalone 상태바 색이 선택 테마를 따른다.
- **SC-56.** 모든 테마에서 본문 텍스트 대비비가 4.5:1 이상이다.
- **SC-57.** 8종 테마 CSS가 생성 스크립트 산출물이며 수기 편집본이 아니다.

---

## 5. 마일스톤

| M | 범위 | 저장소 | 완료 조건 | 공수 |
|---|------|--------|-----------|------|
| **M12** | ReportsService + ReportsView + 홈 진입점 | 모바일 | SC-38~43 | 0.5일 |
| **M13** | 테마 8종 이식 + 생성 스크립트 + FOUC/상태바 | 모바일 | SC-52~57 | 1일 |
| **M14** | inbox 스키마 v2 + QuickMemoSheet 확장 + InboxSentView | 모바일 | SC-44, 49, 51 | 1일 |
| **M15** | InboxService + InboxPanel + auto-sync(pull) | **데스크탑** | SC-45~48, 50 | 2일 |
| M16 | (선택) reports/index.json + 팔레트 단일 소스화 | 양쪽 | — | 0.5일 |

**의존성.** M14는 M15 없이도 배포 가능하다(파일이 쌓일 뿐 손실 없음).
M15는 M14 없이도 의미가 있다(기존 v1 메모 2건을 승격할 수 있다).
**M12·M13은 서로도, M14·M15와도 독립이다.** 원하는 순서로 붙이면 된다.

**중간 점검.** M12 완료 후(주간보고 렌더링 방향 확인), M13 완료 후(8종 실기기 육안 확인),
M15 완료 후(왕복 전체 확인).

---

## 6. 리스크와 미해결 쟁점

1. **자동 pull이 로컬 작업을 방해할 위험.** 데스크탑이 편집 중일 때 rebase가 돌면 파일이 바뀐다.
   → pull 대상이 `inbox/` 뿐일 때가 대부분이지만, **편집 중인 저널이 있으면 pull을 미루는** 가드가 필요하다.
2. **`getLatestCommitSha`의 기본 브랜치가 `master`다.** 데이터 저장소 기본 브랜치를 확인하고,
   상수로 빼거나 `/repos/{repo}`의 `default_branch`를 읽어 결정하도록 고칠 것(§1.5).
3. **`reports/` 폴더의 이질성.** 사용자가 산출물 보관에도 쓰고 있어 무관 파일이 늘어난다.
   장기적으로 주간보고를 `reports/weekly/` 하위로 분리하는 편이 낫다(데스크탑 변경 필요, 마이그레이션 동반).
4. **inbox 첨부 이미지.** SPEC v5 §5.2의 `inbox/assets/`는 아직 미구현이다.
   승격 시 이미지 경로를 저널 마크다운에서 어떻게 참조할지 미정.
   모바일 `GitHubImage.tsx`가 이미 Private 저장소 이미지를 렌더하므로 재사용 가능하다.
5. **8종 테마에서의 슬레이트 유형색.** §4.3의 "공용 상속 + 개별 오버라이드"는 실기기 확인 전 가설이다.
   M13 중간 점검에서 육안 검증이 필요하다.
6. **저장소 용량.** 데이터 저장소에 `.pptx`(2 MB급)와 `node_modules` 흔적이 추적되고 있다.
   모바일 초기 트리 조회 비용에 직접 영향을 준다. 정리는 이 계획의 범위 밖이지만 기록해 둔다.
7. **API 레이트 리밋.** 주간보고 목록(+1) · inbox 상태(+1) · 팔레트(+1)로 요청이 늘어난다.
   PAT 기준 시간당 5,000회라 여유가 크지만, `_state.json`·`index.json`처럼
   **단일 파일로 뭉치는 설계**를 계속 유지할 것.

---

## 7. 원칙 재확인

이 계획은 기존 원칙을 하나도 깨지 않는다.

- 서버를 두지 않는다. 저장소가 백엔드다.
- 모바일은 **읽기 + `inbox/` 쓰기**만 한다. `journals/`·`markdown/`·`wiki/`·`meta-index.json`은 건드리지 않는다.
- 타입(`InboxPath`) + 런타임 가드 이중 방어를 유지한다.
- AI 호출은 데스크탑에만 있다. 모바일은 공유 시트로 위임한다.
- 코드·주석·커밋 메시지에 회사·조직·내부 시스템 맥락을 넣지 않는다.

---

## 8. 기억해야 할 핵심 요약

주간보고는 **이미 원격에 있음.** `reports/{from}_{to}_{ts}.json` + `wiki/notes/weekly-*.md` 이중으로 저장됨.
모바일에 읽는 코드가 없을 뿐임. 가장 싸고 효과 큼. 먼저 할 것.

모바일이 쓴 inbox 메모를 데스크탑이 읽는 코드는 **한 줄도 없음.** 저장소 전체 검색 0건임.
파일 2건이 이미 도착해 방치돼 있음. 배관은 뚫려 있고 수신부만 없음.

자동 동기화가 **push 단방향**임. 게다가 로컬이 clean하면 skip이라 모바일 변경을 영영 모를 수 있음.
pull을 넣지 않으면 과제 B는 어떻게 짜도 동작 안 함. 이게 B의 진짜 급소임.

모바일이 저널을 직접 쓰는 안은 채택 안 함. 하루치 슬레이트 통째 유실 시나리오가 실재하고,
마크다운·위키·메타 인덱스 갱신을 폰이 못 함. inbox 경유 승격이 유일하게 맞음.

테마 8종은 실제로 **5색만 정의**하고 나머진 `color-mix` 파생임. 옮길 건 5색뿐임.
난점은 모바일에만 있는 `--glass-*`를 테마 배경에서 새로 도출하는 것임. 라이트 틴트 그대로 쓰면 다 깨짐.

FOUC 방지 인라인 스크립트와 `theme-color` 메타 런타임 갱신을 빼먹으면 티가 크게 남.
데스크탑엔 없는 모바일 고유 항목임.

권고 순서 A(0.5일) → C(1일) → B(3일, 데스크탑 세션 필요)임. 셋 다 서로 독립이라 순서는 바꿔도 됨.
