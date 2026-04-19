# CLAUDE.md — Workwiki Mobile 작업 규율

> 이 파일은 Claude Code가 이 프로젝트에서 작업할 때 반드시 준수해야 할 규율을
> 담는다. 매 세션 시작 시 이 파일을 먼저 읽어라.
>
> **프로젝트 루트.** `C:\01_Antigravity\15_work_log_mobile\`
> **작성 기준일.** 2026-04-19

---

## 0. 권위의 계층

작업 중 의사결정이 필요할 때 아래 순서로 문서를 참조한다.

1. **이 CLAUDE.md** — 최우선. 작업 규율.
2. **SPEC v4** (`docs/WORKWIKI_MOBILE_SPEC_v4.md`) — 구현 명세.
3. **Design Brief v2** (`docs/WORKWIKI_MOBILE_DESIGN_BRIEF_v2.md`) — 제품 맥락.
4. **Claude Design 핸드오프 번들** (`https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q`) — 디자인 구체 값.
5. 사용자의 인라인 지시 — 위 문서들과 충돌 시 사용자에게 확인.

**충돌 해결 원칙.** 디자인 세부는 핸드오프 번들이 우선. 건축 원칙(ADR)은 SPEC이 우선. 작업 절차는 CLAUDE.md가 우선.

---

## 1. 매 변경 후 빌드 게이트

모든 코드 변경 후 아래 두 명령을 순서대로 실행하여 통과를 확인한다. 데스크탑 Workwiki의 Phase 0 Harness 패턴을 계승한다.

```powershell
npx tsc --noEmit          # 타입 체크
npm run build              # Vite 빌드
```

실패하면 즉시 수정한다. 실패한 상태로 다음 작업으로 넘어가지 않는다.

**마일스톤 완료 추가 게이트.**
```powershell
npm run lint               # ESLint (있으면)
```

**M7 완료 시 추가 게이트.**
- Lighthouse PWA 점수 90+ 확인
- 실제 Cloudflare Pages 배포 성공 확인

---

## 2. 커밋 규칙

### 2.1 커밋 메시지 형식
```
{type}: {short description} ({scope})
```

- **type:** `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`, `m{N}` (마일스톤)
- **scope:** 변경된 영역 (`tree-nav`, `auth`, `inbox` 등)

예시:
```
m1: initial vite + pwa scaffold
feat: implement TreeNav with category grouping (wiki)
fix: github client etag handling (github-client)
docs: cloudflare setup guide (deploy)
```

### 2.2 커밋 내용 제약 — 매우 중요
다음은 커밋 메시지·코드 주석·변수명·로그에 **절대** 포함하지 않는다.

- 회사명 (LG, LG에너지솔루션 등)
- 사내 시스템명 (c-DN, 데스크탑 Workwiki 내부 용어 등)
- 구체 업무 맥락 (프로젝트명, 인물명, 팀 조직도 등)
- 사내 프록시·보안 시스템 이름

**허용되는 일반화 표현:**
- "내부망 프록시 대응" (대신 "LG Somansa 대응" 금지)
- "프로젝트 페이지 참조" (대신 "c-DN 프로젝트 참조" 금지)
- "업무 지식 관리 도구" (대신 "LG PI 업무 도구" 금지)

**예외.** `docs/` 폴더의 참조 문서는 사용자가 작성한 원본이므로 내용을 변경하지 않는다. 다만 Claude Code가 새로 생성하는 문서·주석·코드는 모두 일반화 원칙을 따른다.

### 2.3 Push 규칙
- 각 마일스톤 완료 시점에 `git push origin main`
- Cloudflare Pages가 자동 배포하므로 push는 곧 배포
- 빌드 실패가 예상되는 WIP 커밋은 push하지 않음

---

## 3. 마일스톤별 진행 규칙

### 3.1 중간 점검 지점 (필수)
아래 시점에는 반드시 사용자에게 확인을 요청하고 진행을 멈춘다.

- **M0 완료 후** — 핸드오프 번들 fetch 결과 요약 제시. 추출된 디자인 시스템 개요 공유.
- **M3 완료 후** — TreeNav + MarkdownView 동작 데모. 디자인 방향 확인.
- **M6 완료 후** — QuickMemo로 실제 inbox 쓰기 테스트 결과 공유.
- **M7 완료 후** — Cloudflare Pages 배포 성공 확인. 실기기 테스트 안내.

중간 점검 지점 외에는 연속 진행해도 된다.

### 3.2 각 마일스톤 공통 절차
1. 작업 전: 관련 SPEC 섹션 재확인
2. 작업 중: 빌드 게이트 수시 통과
3. 작업 후: 커밋 + (필요 시) 푸시
4. 문서 업데이트: 구조적 변경 시 SPEC 반영 제안

---

## 4. 디자인 구현 규칙

### 4.1 핸드오프 번들 fetch
```
URL: https://api.anthropic.com/v1/design/h/ZDaXwWUOolEaTDR2KhZJ2Q
각 화면 접근: ?open_file=HomeView.html, ?open_file=TreeNav.html 등
```

번들은 gzip 압축되어 있다. 압축 해제 후 README를 먼저 읽고 전체 구조를 파악한다.

### 4.2 React 컴포넌트화
번들의 HTML은 React 컴포넌트로 변환하되 다음을 준수:
- 스타일 토큰은 CSS 변수로 추출 (`--color-bg`, `--color-text` 등)
- Tailwind가 있다면 tailwind.config.js의 theme에 반영
- 라이트/다크 각각의 토큰 세트 유지
- 컴포넌트 이름은 번들 파일명과 일치 (HomeView.html → HomeView.tsx)

### 4.3 번들과 Brief 충돌 시
번들에 **생산성 도구 원칙에 어긋나는** 디자인 요소가 있다면 구현 전 사용자에게 확인한다.

예: 강한 채도 컬러, 과도한 애니메이션, 친근한 마스코트, 의미 없는 장식 요소.

### 4.4 테마 전환
- 라이트/다크/시스템 자동 3옵션
- 기본값: 시스템 자동
- `useTheme` 훅으로 관리
- `prefers-color-scheme` 미디어 쿼리 리스너 등록
- Settings 변경 시 즉시 반영, 페이지 리로드 없이

---

## 5. 코드 품질 원칙

### 5.1 TypeScript
- strict 모드 필수
- `any` 사용 금지
- 인터페이스는 `I` 접두사 없이 PascalCase
- 함수형 컴포넌트만 사용

### 5.2 파일명
- 컴포넌트: PascalCase (`TreeNav.tsx`)
- 훅: camelCase + use 접두사 (`useTheme.ts`)
- 서비스: PascalCase (`GitHubClient.ts`)
- 유틸: camelCase (`slugify.ts`)

### 5.3 import 순서
```typescript
// 1. React
import { useState, useEffect } from 'react'

// 2. 외부 라이브러리
import { marked } from 'marked'

// 3. 내부 services
import { GitHubClient } from '@/services/GitHubClient'

// 4. 내부 components
import { TreeNav } from '@/components/TreeNav'

// 5. 내부 utils·types
import { slugify } from '@/utils/slugify'
import type { Document } from '@/types'
```

### 5.4 주석 언어
- JSDoc·타입 주석: 영어
- 복잡 로직 설명 주석: 한국어 허용 (단, 회사 맥락 제외)
- 커밋 메시지: 영어

### 5.5 에러 처리
- Silent catch 금지. 모든 에러는 처리되거나 재throw
- 사용자에게 노출되는 에러는 원인과 다음 행동을 한 줄로

---

## 6. 금지 사항 (재강조)

### 6.1 절대 하지 않는 것
- `journals/`, `markdown/`, `wiki/`, `meta-index.json`, `log.md` **수정** 코드 작성
- Anthropic API 직접 호출 코드 작성 (ADR-008)
- 자체 AI 채팅 UI 구현 (ADR-008)
- Cloudflare Worker 작성 (ADR-008)
- PAT·API Key 하드코딩
- 회사명·내부 시스템명 코드에 포함
- `localStorage` 외부에 민감 정보 저장

### 6.2 권한 체크
`GitHubClient.putContents`의 `path` 파라미터는 반드시 `inbox/`로 시작해야 한다. 런타임 가드로 검증하되, 타입 시스템으로도 가능하면 더 좋다.

```typescript
type InboxPath = `inbox/${string}`
putContents(path: InboxPath, ...): Promise<PutResult>
```

---

## 7. 배포 관련 (Cloudflare Pages)

### 7.1 CLOUDFLARE_SETUP.md
M1에서 프로젝트 루트에 `CLOUDFLARE_SETUP.md`를 생성한다. 다음 내용 포함:

- Cloudflare 계정 가입 링크
- GitHub 저장소 연결 절차
- 빌드 설정 (Framework: Vite, Build: `npm run build`, Output: `dist`)
- 커스텀 도메인 설정 (선택)
- 첫 배포 확인 절차
- 이후 자동 배포 흐름 설명

### 7.2 `.github/workflows/` 생성 금지
Cloudflare Pages가 Git 연동 시 자동 빌드하므로 GitHub Actions 워크플로우는 불필요하다. 실수로 만들면 중복 빌드 발생.

### 7.3 Vite 설정
```typescript
// vite.config.ts
export default {
  base: '/',  // Cloudflare Pages는 루트 경로
  build: {
    outDir: 'dist',
    sourcemap: false  // 배포 크기 최소화
  }
}
```

---

## 8. 데스크탑 Workwiki 연동 (Phase 4·6)

Phase 4와 Phase 6는 **이 프로젝트가 아닌 `Worklog` repo에서** 작업한다. Workwiki Mobile 저장소에서는 Phase 1~3, 5′만 다룬다.

데스크탑 확장은 별도 Claude Code 세션을 `Worklog` 경로에서 열어 진행한다.

---

## 9. 사용자 확인이 필요한 상황

아래 경우 임의로 진행하지 않고 사용자에게 묻는다.

- SPEC에 없는 새 의존성 추가 (예: 상태관리 라이브러리, 차트 라이브러리)
- SPEC의 ADR을 우회해야 할 것 같은 상황
- 디자인 핸드오프 번들의 내용이 §6.1 원칙과 충돌
- 예상 공수가 마일스톤 계획의 1.5배 이상 초과 전망
- 브라우저 호환성 문제로 기능 축소 필요
- LG 사내망 제약이 발견되는 경우 (CSP·CORS 등)

---

## 10. 세션 시작 시 체크리스트

```
□ 이 CLAUDE.md 읽음
□ SPEC v4 §0, §2, §14 확인
□ 현재 git branch 확인
□ 진행 중인 마일스톤 확인
□ 전 세션에서 남긴 TODO 확인
□ Claude Design 핸드오프 번들 fetch 가능 여부 확인
```

---

## 11. 세션 종료 시 체크리스트

```
□ 빌드 게이트 통과
□ 커밋 완료
□ 다음 세션을 위한 TODO 메모 (있으면)
□ push 완료 (마일스톤 완료 시)
```

---

## 12. 기억해야 할 핵심

이 프로젝트는 **사용자의 개인 지식 관리 도구**의 모바일 확장이다. 생산성·차분함·오래 봐도 편함이 핵심 가치다.

코드는 개인 Private repo에 있지만 위생 원칙상 회사 맥락을 넣지 않는다.

디자인은 Claude Design이 결정한다. 이 프로젝트의 Claude Code는 디자인을 "창작"하지 않고 "정확히 구현"한다.

중간 점검 지점에서는 반드시 멈추고 사용자 확인을 받는다. Autonomy보다 alignment가 우선이다.

빌드 게이트가 실패한 상태로 다음 작업 진행 금지. 항상 green 상태 유지.
