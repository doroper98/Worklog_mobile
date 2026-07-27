# Inbox 승격 절차 (M14.5 · B-γ)

> 이 문서는 **데이터 저장소**의 `AGENTS.md`에 붙여넣을 절차서다.
> 데스크탑 앱 소스는 한 줄도 바꾸지 않는다(개선 계획 §0.1, §3.5′).
> 데스크탑의 Claude 터미널(cwd = 데이터 폴더)이 이 절차를 그대로 수행한다.

## 배경

모바일이 `inbox/`에 스키마 v2 프론트매터로 슬레이트를 보낸다. 데스크탑에는
그것을 읽는 코드가 없으므로, 데이터 폴더에 이미 붙어 있는 Claude 터미널이
아래 절차대로 저널에 승격한다. 앱 재빌드가 필요 없다.

## 모바일이 보내는 inbox 스키마 v2

```markdown
---
source: mobile
schema: 2
created_at: 2026-07-27T14:23:05+09:00
device: iPhone (iOS 18.7)
kind: meeting            # meeting | task | memo | append
title: 주간 설계 리뷰
target_date: 2026-07-27  # 이 슬레이트가 귀속될 날짜 (기본: 작성일 KST)
attendees: [홍길동, 김철수]   # kind=meeting일 때만
target_slate_id: slate-…    # kind=append일 때만 (id 또는 제목)
tags: [mobile]
---

본문 마크다운
```

- `kind`가 없으면 v1 quick-memo로 간주한다(하위 호환). 이미 저장소에 있는
  v1 파일 2건도 오류 없이 승격되어야 한다.
- 파일명은 `inbox/YYYY/MM/DD-HHMMSS-{kind}-{slug}.md`. v1 파일명도 파싱 가능해야 한다.

## 데이터 저장소 `AGENTS.md`에 추가할 문단

```markdown
## 모바일 inbox 승격 절차

"inbox 정리해줘"라는 지시를 받으면 다음을 수행한다.

1. `inbox/` 아래 `_processed/`를 제외한 `.md` 파일을 최신순으로 나열하고
   프론트매터를 읽는다.
2. 각 항목에 대해:
   - `kind: append` → `target_slate_id`(또는 제목)로 대상 슬레이트를 찾아
     본문을 이어붙인다.
   - 그 외 → `target_date`의 `journals/YYYY/MM/DD.json`을 읽고, `slates`
     배열 **끝에** 새 항목을 추가한다. `id`는 `slate-{타임스탬프}`,
     `createdAt`/`updatedAt`은 **프론트매터의 `created_at`을 그대로 쓴다.**
3. 저널 파일은 **읽고 → 배열에 추가 → 다시 쓴다.** 기존 슬레이트를
   삭제하거나 순서를 바꾸지 않는다.
4. 처리한 원본을 `inbox/_processed/YYYY/MM/` 으로 이동한다.
5. `inbox/_state.json`에 처리 기록 한 줄을 추가한다(아래 형식).
6. 결과를 표로 보고한다: 파일명 / 귀속 날짜 / 슬레이트 제목 / 조치.

**금지.** 마크다운 생성·위키 ingest·메타 인덱스 갱신은 하지 않는다.
사용자가 앱에서 직접 수행한다.
```

## `inbox/_state.json` 형식

모바일 '보낸 메모' 뷰가 이 파일 **하나만** 읽어 처리 상태를 표시한다(§3.6).

```jsonc
{
  "processed": [
    {
      "originalPath": "inbox/2026/07/27-142305-meeting-주간설계리뷰.md",
      "processedAt": "2026-07-27T15:02:11+09:00",
      "action": "promote",          // promote | append | discard
      "journalDate": "2026-07-27",
      "slateId": "slate-…"
    }
  ]
}
```

- `originalPath`는 **이동 전 경로**여야 한다. 모바일이 자기가 보낸 파일 경로와
  대조하기 때문이다.
- `action: promote|append` → 모바일에서 "반영됨"(초록 체크)으로 표시되고,
  탭하면 `journalDate` 저널로 이동한다.
- `action: discard` → "보류됨"으로 표시된다.

## 수용 기준 (개선 계획 §3.8)

- **SC-45′** "inbox 정리해줘" 한 줄로 승격이 수행된다. 앱 재빌드 없이 동작한다.
- **SC-46′** 승격 후 `git diff`로 기존 슬레이트가 삭제·변형되지 않았음을 확인한다.
- **SC-47′** 승격된 슬레이트의 작성 시각이 모바일 작성 시각으로 보존된다.
- **SC-48′** 처리된 원본이 `inbox/_processed/`로 이동해 다시 잡히지 않는다.
- **SC-50** v1 스키마(기존 2건)도 오류 없이 승격된다.

## 안전망

데이터 폴더가 Git 저장소이므로, 승격이 잘못되면 되돌릴 수 있다. 절차서에
"기존 슬레이트 삭제 금지"를 명시했고, 승격 전 `git status`가 깨끗한지 확인하면
승격만 따로 되돌리기 쉽다.
