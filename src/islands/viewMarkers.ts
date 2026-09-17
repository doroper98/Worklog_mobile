/**
 * viewMarkers — 블록마다 고른 보기를 **마크다운 문서 안에** 적어 두는 표식 (v3.99.2 / WP8-17).
 *
 * 사용자 결정(2026-09-17): 블록별 보기 선택은 이 PC 의 localStorage 가 아니라 문서에 남아야 한다.
 * 문서는 데이터 저장소로 동기화되므로, 같은 규칙을 쓰는 모바일도 데스크톱에서 고른 대로 보여 준다.
 *
 * 표식 형식
 *  - Mermaid 펜스 맨 앞줄: `%% view: mermaid` | `%% view: drawio`  (Mermaid 주석 → 두 파서 모두 무시)
 *    `%% drawio: <slug>`(편집본 연결)만 있으면 draw.io 보기로 친다. 둘 다 있으면 `view:` 가 이긴다.
 *  - 표 **바로 윗줄**: `<!-- ww:view=table -->` | `<!-- ww:view=island -->`
 *    (marked 는 HTML 주석을 그대로 내보내므로 DOM 에서 `<table>` 의 앞 형제 Comment 노드가 된다)
 *
 * 표식이 없으면 기본값(표는 `defaultTableView`, 흐름도는 draw.io/섬 보기)이다.
 */

/** 섬/draw.io 보기 = 'island', 원본(표·Mermaid) 보기 = 'raw' */
export type DocView = 'island' | 'raw';

const MERMAID_VIEW_RE = /^\s*%%\s*view\s*:\s*([A-Za-z.]+)\s*$/;
const MERMAID_DRAWIO_RE = /^\s*%%\s*drawio\s*:\s*([A-Za-z0-9._-]+)\s*$/;
/** 표식은 펜스 맨 앞 몇 줄에서만 찾는다(본문 주석을 표식으로 오해하지 않도록) */
const HEAD_LINES = 3;

/** 펜스 본문에서 보기 표식을 읽는다. 없으면 null. */
export function mermaidViewOf(src: string): DocView | null {
  const head = src.split('\n').slice(0, HEAD_LINES);
  for (const line of head) {
    const m = MERMAID_VIEW_RE.exec(line);
    if (!m) continue;
    const v = m[1].toLowerCase();
    return v === 'mermaid' || v === 'raw' || v === 'src' ? 'raw' : 'island';
  }
  for (const line of head) if (MERMAID_DRAWIO_RE.test(line)) return 'island';
  return null;
}

/** 펜스 본문의 보기 표식을 바꾼다(`null` 이면 지운다). 나머지 줄은 손대지 않는다. */
export function withMermaidViewMarker(src: string, view: DocView | null): string {
  const kept = src.replace(/\s+$/, '').split('\n').filter(l => !MERMAID_VIEW_RE.test(l));
  if (!view) return kept.join('\n');
  return [`%% view: ${view === 'raw' ? 'mermaid' : 'drawio'}`, ...kept].join('\n');
}

const TABLE_VIEW_RE = /ww:view\s*=\s*(table|island)/i;

/** 주석 텍스트(`<!-- ww:view=table -->` 또는 그 내용)에서 보기를 읽는다. */
export function tableViewOfComment(text: string): DocView | null {
  const m = TABLE_VIEW_RE.exec(text);
  if (!m) return null;
  return m[1].toLowerCase() === 'table' ? 'raw' : 'island';
}

/** 표 윗줄에 넣을 주석 한 줄 */
export function tableViewComment(view: DocView): string {
  return `<!-- ww:view=${view === 'raw' ? 'table' : 'island'} -->`;
}

/** 이 줄이 표 보기 표식인가 */
export function isTableViewComment(line: string): boolean {
  return /^\s*<!--[^>]*ww:view\s*=/i.test(line);
}

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

/** 머리글 한 칸을 양쪽(DOM·마크다운 원문)에서 **같은 모양**으로 만든다.
 *  마크다운 강조 기호·이모지·연속 공백을 털어 내 `**항목**` 과 `항목` 이 같게 잡히도록. */
export function normHeaderCell(s: string): string {
  return s.replace(/[*_`~]/g, '').replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

/** 표 머리글 줄(`| a | b |`)을 칸 배열로. 표가 아니면 null. */
export function headerCellsOf(line: string): string[] | null {
  if (!line.includes('|')) return null;
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(normHeaderCell);
  return cells.length ? cells : null;
}

/** 다음 줄이 표 구분선(`|---|:--:|`)인가 */
export function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t);
}
