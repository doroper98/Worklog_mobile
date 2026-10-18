# 실행 계획 — PWA 새 버전 반영 흐름 개선 (v0.14.1)

> 작성일: 2026-10-18. 작성 세션은 진단만 수행했고 코드는 바꾸지 않았다.
> 이 문서는 다음 구현 세션(Opus)이 그대로 따라 실행할 수 있도록 쓴 계획이다.

---

## 0. 배경 — 확인된 사실

| 항목 | 결과 |
|---|---|
| 저장소 | `doroper98/Worklog_mobile` main. PR #10 머지 커밋 `c34481e`. 올바른 저장소 |
| Cloudflare Pages 프로덕션 배포 | `c34481e` → Deploy successful, 2026-10-18 02:40 UTC (11:40 KST). 배포 ID `759ac6f4` |
| 로컬 빌드 | `npm ci` + `npm run build` 통과. 번들에 `0.14.0` 포함 |
| 다른 저장소 오염 | DB-Reviewer_2605: `main`만 존재, 2026-06 이후 변경 없음. 없음 |

즉 서버에는 0.14.0이 올라가 있다. 폰이 0.13.0을 보여주는 원인은 **서비스 워커 갱신 흐름**이다.

## 1. 원인 분석

현재 `vite.config.ts`의 PWA 설정:

- `registerType: 'autoUpdate'` → 생성된 `sw.js`에 `skipWaiting()` + `clientsClaim()`.
- 등록 스크립트(`registerSW.js`)는 `navigator.serviceWorker.register('/sw.js')`만 호출한다.
- 앱 코드 어디에도 "새 버전 감지 → 새로고침" 로직이 없다.
- `index.html`은 프리캐시에서 먼저 서빙된다 (`createHandlerBoundToURL("index.html")`).
- 프리캐시 133개, **약 13 MB** (draw.io 뷰어 4.0 MB, elk 1.4 MB, mermaid 청크 다수).

폰에서 일어나는 순서:

1. 앱 실행 → 옛 프리캐시의 `index.html`과 옛 번들이 뜬다 (0.13.0 표시).
2. 뒤에서 새 `sw.js`를 받아 설치를 시작한다. 설치 = 13 MB 프리캐시 전부 다운로드.
3. 설치가 끝나야 새 워커가 활성화된다. 그래도 **이미 떠 있는 화면은 옛 번들** 그대로다.
4. 앱을 완전히 종료하고 **다시 실행해야** 0.14.0이 보인다.

iOS 홈 화면 PWA는 백그라운드로 가면 다운로드가 끊긴다. 짧게 열었다 닫으면 2단계가 끝나지 않는다.
그래서 "머지 4시간 뒤에도 0.13.0"이 가능하다.

부가 위험: 2단계가 끝나 `clientsClaim()`이 옛 화면을 가로채면, 옛 화면이 나중에 지연 로드하는
청크(`cynefin-옛해시.js` 등)는 프리캐시에서 지워져 있고 프로덕션 도메인에도 없다 → 404.
다이어그램이 갑자기 안 뜨는 증상은 이 경로다.

## 2. 목표

- 새 버전이 준비되면 화면에 배너를 띄우고, 한 번 탭으로 즉시 전환한다.
- 앱이 포그라운드로 돌아올 때와 1시간마다 갱신을 확인한다.
- 옛 화면이 새 워커에 가로채여 깨지는 경로를 없앤다.
- 디자인은 기존 `OfflineBanner`와 같은 토큰·형태만 쓴다 (새 창작 금지, CLAUDE.md §4).

## 3. 변경 목록

### 3.1 `vite.config.ts`

```ts
VitePWA({
  registerType: 'prompt',      // autoUpdate → prompt. sw.js에서 skipWaiting/clientsClaim 제거됨
  injectRegister: false,       // registerSW.js 주입 중단. 앱이 virtual 모듈로 직접 등록
  includeAssets: ['icons/*.png'],
  manifest: false,
  workbox: { /* 기존 그대로 */ },
})
```

### 3.2 `vite-env.d.ts`

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
```

### 3.3 새 훅 `src/hooks/useAppUpdate.ts`

```ts
import { useState, useEffect, useCallback, useRef } from 'react'

import { registerSW } from 'virtual:pwa-register'

/** Re-check for a new service worker this often while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

export interface AppUpdateState {
  /** A new build is installed and waiting; show the banner. */
  needRefresh: boolean
  /** The user tapped "업데이트"; the page is about to reload. */
  applying: boolean
  /** Activate the waiting worker and reload. */
  apply: () => Promise<void>
  /** Ask the browser to look for a new worker now (pull-to-refresh, Settings). */
  checkNow: () => Promise<void>
}

export function useAppUpdate(): AppUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [applying, setApplying] = useState(false)
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const checkNow = useCallback(async () => {
    const r = registrationRef.current
    if (!r || !navigator.onLine) return
    try {
      await r.update()
    } catch (err) {
      // 오프라인·일시 네트워크 오류. 다음 주기나 포그라운드 복귀 때 다시 시도한다.
      console.warn('[pwa] update check failed', err)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    updateSWRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, registration) => {
        registrationRef.current = registration ?? null
      },
      onRegisterError: (err) => {
        console.error('[pwa] service worker registration failed', err)
      },
    })

    const interval = window.setInterval(() => { void checkNow() }, CHECK_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkNow()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkNow])

  const apply = useCallback(async () => {
    const updateSW = updateSWRef.current
    if (!updateSW) return
    setApplying(true)
    // reloadPage=true: waiting worker에 SKIP_WAITING 전송 후 controllerchange에서 새로고침
    await updateSW(true)
  }, [])

  return { needRefresh, applying, apply, checkNow }
}
```

주의:
- `registerSW`는 한 번만 호출한다. `StrictMode` 이중 실행은 effect cleanup이 없으므로
  두 번 호출될 수 있다. 모듈 스코프 플래그(`let registered = false`)로 막는다.
- `console.warn`은 CLAUDE.md §5.5(silent catch 금지)를 지키기 위한 최소 처리다.

### 3.4 새 컴포넌트 `src/components/UpdateBanner.tsx`

`OfflineBanner`를 그대로 본뜬다. 차이는 탭 가능한 버튼이라는 점뿐이다.

```tsx
import { Icon } from '@/components/primitives/Icon'

interface UpdateBannerProps {
  show: boolean
  applying: boolean
  onApply: () => void
}

export function UpdateBanner({ show, applying, onApply }: UpdateBannerProps) {
  if (!show) return null

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={onApply}
        disabled={applying}
        className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-faint)',
          color: 'var(--color-accent)',
        }}
      >
        <Icon name="refresh-cw" size={14} color="var(--color-accent)" sw={2} />
        <span className="flex-1">
          {applying ? '업데이트 중…' : '새 버전이 준비됐습니다'}
        </span>
        {!applying && <span className="font-medium">업데이트</span>}
      </button>
    </div>
  )
}
```

- `Icon` 이름은 `src/components/primitives/Icon.tsx`에 있는 것만 쓴다. `refresh-cw`가 없으면
  기존 아이콘 중 가장 가까운 것을 쓰고, 새 아이콘을 그리지 않는다.
- 터치 타깃 최소 44px를 지킨다 (`py-2` + 텍스트로 부족하면 `min-h-[44px]`).

### 3.5 연결 — `src/App.tsx`, `src/components/HomeView.tsx`

- `AuthenticatedShell`에서 `const update = useAppUpdate()`를 호출한다.
- `HomeView`에 `updateReady`, `updateApplying`, `onApplyUpdate` prop을 추가한다.
- `HomeView.tsx:921` `<OfflineBanner show={offline} />` 바로 아래에 `<UpdateBanner … />`를 둔다.
- `handleRefresh`(풀투리프레시) 끝에 `await update.checkNow()`를 추가한다.
  → 사용자가 "당겨서 새로고침"하면 갱신 확인까지 함께 된다.
- `SettingsView` "앱 정보" 섹션: `<Row label="버전" …/>`는 유지. 추가 행은 선택 사항이며
  이번 범위에 넣지 않는다.

배너는 홈 화면에만 둔다. 다른 화면에서는 홈으로 돌아올 때 보인다. 전역 고정 토스트는 디자인
창작에 해당하므로 사용자 확인 없이 만들지 않는다.

### 3.6 버전

`package.json` `version`: `0.14.0` → `0.14.1`.

## 4. 하지 않는 것

- 프리캐시 축소(draw.io 뷰어를 런타임 캐시로 전환). 오프라인 읽기와 상충한다. 별도 판단 사항.
- 자동 강제 새로고침. QuickMemo 작성 중 입력을 잃을 수 있다. 배너 탭 방식으로 간다.
- `.github/workflows/` 생성 금지 (CLAUDE.md §7.2).

## 5. 검증 절차

1. 빌드 게이트: `npx tsc --noEmit` → `npm run build`.
2. `dist/sw.js`에 `skipWaiting()`·`clientsClaim()`이 **없는지** 확인한다.
   `dist/index.html`에 `registerSW.js` 스크립트 태그가 **없는지** 확인한다.
3. 갱신 시나리오 (headless Chromium, 저장소 사전 설치된 Playwright):
   1. `npm run build && npx vite preview --port 4173` 으로 띄운다.
   2. 페이지 로드 → 홈에서 `mobile · v0.14.1` 확인. SW 활성화까지 대기.
   3. `package.json` 버전을 임시로 `0.14.2`로 바꾸고 다시 빌드한다 (preview는 dist를 그대로 서빙).
   4. 같은 탭에서 `navigator.serviceWorker.getRegistration().then(r => r.update())` 실행.
   5. 배너 "새 버전이 준비됐습니다"가 뜨는지 확인. 탭 → 새로고침 후 `v0.14.2` 표시 확인.
   6. 버전을 `0.14.1`로 되돌리고 다시 빌드한다.
4. 커밋: `fix: prompt for new build and re-check on foreground (pwa)`.

## 6. 사용자 안내 (배포 전 임시 조치)

지금 폰에서 0.14.0을 보려면:

1. 앱을 완전히 종료(앱 전환기에서 위로 밀어 제거).
2. Wi-Fi에서 앱을 열고 홈 화면에 **30초 이상** 머문다 (13 MB 프리캐시 다운로드 시간).
3. 다시 완전히 종료 후 실행. 홈 하단 `mobile · v0.14.0` 확인.

그래도 0.13.0이면 iOS 설정 → Safari → 고급 → 웹사이트 데이터에서 해당 도메인을 지우고
홈 화면 아이콘을 다시 추가한다.
