/**
 * tableIslands — 렌더된 GFM 표(<table>)를 머리글 모양으로 판별해 "섬" DOM 으로 바꾼다.
 *
 * v3.87.0: 마크다운 섬 도입.
 *  - LLM 출력(마크다운 표)은 손대지 않는다. 머리글 낱말과 열 수만 보고 판별하므로
 *    이미 쌓인 문서에도 소급 적용된다.
 *  - 판별이 안 되면 null → 표 그대로. 숫자 열이 많은 행렬은 표를 유지하고 보조 스타일만 붙인다.
 *  - 섬 맨 위에는 "유령 머리글"(원래 표의 머리글 낱말을 값이 놓일 자리에 둔 점선 행)을 둬
 *    무엇이 기한이고 무엇이 비고인지 표처럼 읽히게 한다.
 *  - React 의존 없음(모바일 공유 가능). 스타일은 styles/islands.css 의 ww-* 클래스.
 */

export type TableIslandKind = 'kv' | 'dec' | 'todo' | 'next' | 'status' | 'rating' | 'ba' | 'issues' | 'tree' | 'map' | 'matrix' | 'bars' | 'compare' | 'records';

export const TABLE_KIND_LABEL: Record<TableIslandKind, string> = {
  kv: '사실 목록', dec: '결정 목록', todo: '체크리스트', next: '세로 궤도', status: '상태 목록',
  rating: '점 격자', ba: '이전·이후', issues: '사안 목록', tree: '묶음 개요', map: '이름 바꿈', matrix: '수치 행렬',
  bars: '막대', compare: '비교', records: '카드 목록',
};

export interface ParsedTable { headers: string[]; rows: string[][]; cells: HTMLElement[][] }

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

function cellText(el: Element): string {
  return (el.textContent || '').replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

export function parseTable(table: HTMLTableElement): ParsedTable | null {
  const trs = Array.from(table.querySelectorAll('tr'));
  if (trs.length < 2) return null;
  const headEls = Array.from(trs[0].children).filter(c => c.tagName === 'TH' || c.tagName === 'TD');
  const headers = headEls.map(cellText);
  if (headers.length < 2) return null;
  const rows: string[][] = []; const cells: HTMLElement[][] = [];
  for (let i = 1; i < trs.length; i++) {
    const tds = Array.from(trs[i].children).filter(c => c.tagName === 'TD' || c.tagName === 'TH') as HTMLElement[];
    if (tds.length === 0) continue;
    rows.push(tds.map(cellText));
    cells.push(tds);
  }
  if (rows.length === 0) return null;
  return { headers, rows, cells };
}

const isNum = (s: string) => /^[-+]?\d[\d,]*(?:\.\d+)?\s*(?:%|건|개|명|원|억|만|천|kg|g|mm|ms|s)?$/.test(s.trim()) || /^\d+(?:\.\d+)?$/.test(s.trim());

const isBlank = (v: string) => /^(?:|-|—|–|n\/a|해당 ?없음)$/i.test(v.trim());

function numericCols(p: ParsedTable): number[] {
  const out: number[] = [];
  for (let c = 0; c < p.headers.length; c++) {
    const vals = p.rows.map(r => r[c] || '').filter(v => !isBlank(v));
    if (vals.length >= 1 && vals.length >= p.rows.length * 0.3 && vals.every(isNum)) out.push(c);
  }
  return out;
}


/** 열의 역할을 머리글 낱말로 알아본다. 정확한 머리글 조합이 아니라 역할 조합으로 판별해 표 대부분을 덮는다.
 *  (실데이터 1,879개 표 · 고유 머리글 1,193종 조사 결과) */
export interface ColumnRoles { idx: number; who: number; when: number; status: number; level: number; body: number; title: number }
export function columnRoles(p: ParsedTable): ColumnRoles {
  const hs = p.headers;
  const f = (re: RegExp, skip: number[] = []) => hs.findIndex((h, i) => !skip.includes(i) && re.test(h));
  const idx = f(/^(#|no\.?|번호|순번|seq|순서)$/i);
  const who = f(/담당|주체|책임자|책임|owner|발언자|이해관계자|참석자|대상자|수행/, [idx]);
  const when = f(/기한|일정|시점|시기|due|마감|예상|일자|날짜|시각|완료일|목표일|deadline/i, [idx, who]);
  const status = f(/상태$|^상태|status|진척|적재/i, [idx, who, when]);
  const level = f(/우선순위|심각도|영향도|중요도|priority|등급|위험도/i, [idx, who, when, status]);
  const body = f(/액션|행동|action|내용|후속|작업|항목|결정|이슈|미결|리스크|기능|설명|제목|요지|안건|대안|과제/i, [idx, who, when, status, level]);
  const title = hs.findIndex((_h, i) => ![idx, who, when, status, level].includes(i));
  return { idx, who, when, status, level, body: body >= 0 ? body : title, title };
}

const shortCells = (p: ParsedTable, c: number, max: number) => p.rows.every(r => (r[c] || '').length <= max);
const avgLen = (p: ParsedTable, c: number) => p.rows.reduce((a, r) => a + (r[c] || '').length, 0) / Math.max(1, p.rows.length);

export function classifyTable(p: ParsedTable): TableIslandKind | null {
  const hs = p.headers, cols = hs.length, n = p.rows.length;
  const nums = numericCols(p);
  const R = columnRoles(p);
  // 점 격자: 발언자/평가자 + 숫자 열 5개 이상 + 평균
  if (/발언자|평가자|이름|참석자/.test(hs[0]) && nums.length >= 5 && /평균|합계|점수/.test(hs[cols - 1])) return 'rating';
  // 이전·이후: 행 2개, 숫자 열 2~4개, 첫 열은 글자
  if (n === 2 && nums.length >= 2 && nums.length <= 4 && !nums.includes(0)) return 'ba';
  // 수치 행렬: 숫자 열 4개 이상
  if (nums.length >= 4) return 'matrix';
  // 막대: 숫자 열 하나 + 이름 열 (예: 항목|값, 구분|수량)
  if (nums.length === 1 && !nums.includes(0) && cols <= 3 && n >= 2 && n <= 16 && shortCells(p, 0, 30)) return 'bars';
  // 이름 바꿈: 구 → 신
  if (cols >= 2 && /^(구|舊|기존|이전|as-?is|현재)/i.test(hs[0]) && /^(신|新|변경|신규|이후|to-?be)/i.test(hs[1])) return 'map';
  // 결정 목록: 결정 열이 있으면 (번호 유무·근거/조건 열 유무 무관)
  if (cols <= 4 && hs.some(h => /결정/.test(h))) return 'dec';
  // 세로 궤도: 후속·다음·단계·절차 + (담당 또는 일정)
  if (hs.some((h, i) => i !== R.idx && /후속|다음|단계|절차|스텝|step|프로세스/i.test(h)) && (R.who >= 0 || R.when >= 0) && cols >= 3) return 'next';
  // 체크리스트: 담당 + (기한 또는 상태) + 본문
  if (R.who >= 0 && (R.when >= 0 || R.status >= 0) && R.body >= 0 && R.body !== R.who) return 'todo';
  // 사안 목록: 이슈·미결·리스크·문제 + 열 3개 이상
  if (cols >= 3 && hs.some((h, i) => i !== R.idx && /이슈|미결|리스크|문제|블로커|장애/.test(h))) return 'issues';
  // 상태 목록: 상태 열 값이 대부분 상태 낱말
  if (R.status >= 0 && cols <= 5) {
    const known = p.rows.filter(r => statusKind(r[R.status] || '') !== null).length;
    if (known >= Math.max(1, n * 0.6)) return 'status';
  }
  // 묶음 개요: 앞 열 2개 이상이 연속 반복
  if (cols >= 4 && n >= 6) {
    let rep = 0;
    for (let i = 1; i < n; i++) if (p.rows[i][0] === p.rows[i - 1][0] && p.rows[i][1] === p.rows[i - 1][1]) rep++;
    if (rep >= (n - 1) * 0.6) return 'tree';
  }
  // 사실 목록: 2열이고 첫 열이 짧은 라벨
  if (cols === 2 && n <= 24 && avgLen(p, 0) <= 14) return 'kv';
  // 비교: 첫 열이 기준(구분·항목)이고 나머지 열이 선택지(역할 열 없음), 값이 짧다
  if (cols >= 3 && cols <= 5 && R.who < 0 && R.when < 0 && R.status < 0 && R.level < 0 && /구분|항목|기준|비교|관점|criteria|측면/i.test(hs[0]) && hs.slice(1).every(h => h.length >= 3) && avgLen(p, 1) <= 40 && n <= 12) return 'compare';
  // 카드 목록: 열 3개 이상, 글자 위주 (짧은 값만 빽빽한 표는 표로 둔다)
  if (cols >= 3 && n <= 40) {
    const dense = cols >= 5 && p.rows.every(r => r.every(v => v.length <= 6));
    if (!dense) return 'records';
  }
  return null;
}

/**
 * v3.99.2(WP8-17): 표식이 없을 때 이 표를 **섬**으로 볼지 **표**로 볼지 정한다.
 *
 * 사용자 결정(2026-09-17): "표가 적절한 것은 표가 낫다. 협의 이력 같은 것은 섬을 유지하고,
 * 나머지는 표로 되돌린다. 단 억지로 표로 쓴 것(줄글을 칸에 밀어 넣은 것)은 섬이 낫다."
 * → 읽는 사람이 무엇을 하려는지(역할)로 가른다.
 *   - 섬: 순서를 따라가는 것(next) · 할 일(todo) · 진행 상태(status) · 결정/협의 이력(dec, records)
 *         · 항목과 설명 2열 줄글(kv) · 묶음 개요(tree) · 긴 사안 목록(issues)
 *   - 표: 값을 **맞대어 보는** 것 — 점 격자(rating) · 수치 행렬(matrix) · 비교(compare) ·
 *         이전·이후(ba) · 막대(bars) · 이름 바꿈(map), 그리고 **열 4개 이상 + 모든 열이 짧을 때**는
 *         종류와 무관하게 표(빽빽한 값 표는 표가 제일 읽기 쉽다).
 *   길이는 **열마다** 잰다. 전체 셀 평균을 쓰면 `항목|담당|기한|내용` 처럼 짧은 열 셋에
 *   줄글 열 하나가 붙은 표가 평균에 묻혀 '빽빽한 값 표'로 잘못 분류된다.
 * 모바일은 이 파일을 그대로 복사해 같은 기본값을 얻는다.
 */
export function defaultTableView(kind: TableIslandKind, p: ParsedTable): 'island' | 'table' {
  const cols = p.headers.length;
  // 열마다 평균 글자 수 → 가장 긴 열이 그 표의 '줄글 정도'다
  const colAvg = p.headers.map((_, c) => {
    const vals = p.rows.map(r => (r[c] || '').length);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const longest = colAvg.length ? Math.max(...colAvg) : 0;
  // 열이 많고 **모든 열이** 짧으면 무조건 표
  if (cols >= 4 && longest <= 12) return 'table';
  switch (kind) {
    case 'rating': case 'matrix': case 'compare': case 'ba': case 'bars': case 'map':
      return 'table';
    case 'next': case 'todo': case 'status': case 'dec': case 'tree':
      return 'island';
    case 'records':
      // 협의·결정·이력 성격이면 섬, 그 밖의 카드 목록은 표
      return /협의|결정|이력|회의|논의|합의|경과|기록/.test(p.headers.join(' ')) ? 'island' : 'table';
    case 'issues':
      return longest >= 18 ? 'island' : 'table';
    case 'kv':
      // 항목/설명 2열 줄글이면 섬, 짧은 값 목록이면 표
      return cols <= 2 && longest >= 18 ? 'island' : 'table';
    default:
      return 'table';
  }
}

/** 우선순위 표(우선순위·항목·판단)를 읽어 원인·결과 섬에 합칠 정보로 만든다. 못 읽으면 null. */
export function parsePriorityTable(p: ParsedTable): Map<string, { level: string; note: string }> | null {
  const hs = p.headers;
  const iLv = hs.findIndex(h => /우선순위|중요도|priority|등급|심각도/i.test(h));
  const iItem = hs.findIndex((h, i) => i !== iLv && /항목|리스크|사안|내용|이슈/.test(h));
  const iNote = hs.findIndex((h, i) => i !== iLv && i !== iItem && /판단|근거|비고|영향|설명/.test(h));
  if (iLv < 0 || iItem < 0) return null;
  const m = new Map<string, { level: string; note: string }>();
  for (const r of p.rows) { const item = (r[iItem] || '').trim(); if (item) m.set(item, { level: (r[iLv] || '').trim(), note: iNote >= 0 ? (r[iNote] || '').trim() : '' }); }
  return m.size ? m : null;
}

/** 본인 이름: applyIslands 가 넘겨준다(없으면 앱 주체자 기본값). */
let SELF_NAME = '서영균';
export function setSelfName(name: string): void { if (name) SELF_NAME = name; }

export type StatusKind = 'done' | 'run' | 'hold' | 'need' | 'stop';

export function statusKind(s: string): StatusKind | null {
  const v = s.replace(EMOJI_RE, '').trim();
  if (!v) return null;
  // '미착수·미완료' 처럼 부정 접두가 붙은 것은 먼저 걸러 '착수·완료' 로 오판하지 않게 한다
  if (/^미\s*(착수|진행|완료|반영|적재|연결|수령|확정|처리|해결|검토|결정|응답|회신)|not started|미정/i.test(v)) return 'need';
  if (/완료|done|closed|해결|반영됨|회신됨|적재됨|연결됨/i.test(v)) return 'done';
  if (/진행|예정|in.?progress|ongoing|요청됨|착수|수행 중/i.test(v)) return 'run';
  if (/보류|장기|대기|유보|hold|pending|지연/i.test(v)) return 'hold';
  if (/검토|확인|미정|필요|todo|open|미확인/i.test(v)) return 'need';
  if (/중단|취소|실패|블로커|결정 필요|위험/i.test(v)) return 'stop';
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// DOM 빌더
// ────────────────────────────────────────────────────────────────────────────

function h(tag: string, cls?: string, text?: string): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** 원래 셀의 인라인 서식(굵게, 코드, 배지 등)을 보존하려고 셀 내용을 옮겨 붙인다. */
function cellInto(target: HTMLElement, cell: HTMLElement | undefined): HTMLElement {
  if (cell) target.innerHTML = cell.innerHTML.replace(EMOJI_RE, '');
  return target;
}

const HONORIFIC_RE = /\s*(책임|선임|수석|전문연구위원|팀장|담당|부사장|사장|상무|이사|과장|대리|사원|연구원|위원)?\s*님$/;

/** 괄호 밖의 , · / 및/와/과 에서만 나눈다 — "SM (PK/FK 물리 탐색)" 은 한 덩어리 */
function splitOutsideParens(text: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    if (depth === 0) {
      if (c === ',' || c === '·' || c === '/') { out.push(cur); cur = ''; continue; }
      const m = /^\s(및|와|과)\s/.exec(text.slice(i));
      if (m) { out.push(cur); cur = ''; i += m[0].length - 1; continue; }
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function personChips(text: string): HTMLElement {
  const wrap = h('span', 'ww-people');
  // "서영균 → 김수민/정운용" : 앞은 주체, 뒤는 대상
  const arrow = text.split(/\s*(?:→|->)\s*/);
  if (arrow.length === 2) {
    wrap.appendChild(personChips(arrow[0]));
    wrap.appendChild(h('span', 'ww-arrow', '→'));
    wrap.appendChild(personChips(arrow[1]));
    return wrap;
  }
  const parts = splitOutsideParens(text).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const isTeam = /팀|조직|부서|담당$|센터|실$|그룹/.test(p) && !HONORIFIC_RE.test(p);
    const name = isTeam ? p : p.replace(HONORIFIC_RE, '').trim();
    if (!name) continue;
    wrap.appendChild(h('span', isTeam ? 'ww-chip ww-chip-team' : 'ww-chip ww-chip-person', name));
  }
  return wrap;
}

function dateChip(text: string): HTMLElement {
  const v = text.trim();
  const chip = h('span', 'ww-chip ww-chip-date', v || '기한 없음');
  if (/미정|tbd|미확정/i.test(v)) chip.classList.add('ww-chip-warn');
  else if (!/^\d{4}-\d{2}-\d{2}/.test(v)) chip.classList.add('ww-chip-soft');
  return chip;
}

function statusToken(text: string): HTMLElement {
  const k = statusKind(text) || 'need';
  return h('span', `ww-st ww-st-${k}`, text.replace(EMOJI_RE, '').trim());
}

function ghost(cls: string, ...parts: Array<HTMLElement | string>): HTMLElement {
  const g = h('div', `ww-head ${cls}`);
  for (const p of parts) g.appendChild(typeof p === 'string' ? h('span', undefined, p) : p);
  return g;
}
function ghostCell(main: string, sub?: string): HTMLElement {
  const c = h('span', undefined, main);
  if (sub) c.appendChild(h('small', undefined, sub));
  return c;
}

function buildKv(p: ParsedTable): HTMLElement {
  const dl = h('dl', 'ww-kv');
  p.rows.forEach((r, i) => {
    dl.appendChild(h('dt', undefined, r[0]));
    const dd = h('dd');
    if (/관련자|참석자|참여자|담당자|관계자|주요 관련자/.test(r[0])) dd.appendChild(personChips(r[1] || ''));
    else if (/^\d{4}-\d{2}-\d{2}/.test(r[1] || '') || /^(meeting|task|memo|daily)$/i.test(r[1] || '')) dd.appendChild(h('span', 'ww-chip ww-chip-date', r[1]));
    else { cellInto(dd, p.cells[i][1]); if ((r[1] || '').length > 40) dd.classList.add('ww-long'); }
    dl.appendChild(dd);
  });
  return dl;
}

function buildDec(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iDec = hs.findIndex(h => /결정/.test(h)); const iNum = R.idx;
  const noteCols = hs.map((_h, i) => i).filter(i => i !== iDec && i !== iNum);
  const frag = h('div');
  frag.appendChild(ghost('ww-head-dec', iNum >= 0 ? hs[iNum] : '#', ghostCell(hs[iDec], noteCols.map(i => hs[i]).join(' · ') || undefined)));
  const ol = h('ol', 'ww-dec');
  p.rows.forEach((r, i) => {
    const li = h('li'); const box = h('div');
    li.appendChild(h('span', 'ww-dec-n', iNum >= 0 ? r[iNum] : String(i + 1)));
    box.appendChild(cellInto(h('div', 'ww-dec-d'), p.cells[i][iDec]));
    for (const c of noteCols) {
      if (!(r[c] || '').trim()) continue;
      const note = cellInto(h('div', 'ww-dec-c'), p.cells[i][c]);
      note.dataset.label = hs[c].replace(/\s.*$/, '').slice(0, 4);
      box.appendChild(note);
    }
    li.appendChild(box); ol.appendChild(li);
  });
  frag.appendChild(ol);
  return frag;
}

function buildTodo(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iWho = R.who, iAct = R.body, iDue = R.when, iSt = R.status;
  const memoCols = hs.map((_h, i) => i).filter(i => ![iWho, iAct, iDue, iSt, R.idx].includes(i));
  const frag = h('div');
  const row = h('span', 'ww-head-row'); row.appendChild(h('i', 'ww-box')); row.appendChild(ghostCell(hs[iAct], memoCols.map(i => hs[i]).join(' · ') || undefined));
  const tail = h('span', 'ww-head-tail'); if (iSt >= 0) tail.appendChild(h('span', 'ww-st ww-st-need', hs[iSt])); if (iDue >= 0) tail.appendChild(h('span', 'ww-chip', hs[iDue])); row.appendChild(tail);
  frag.appendChild(ghost('ww-head-todo', `${hs[iWho]} (묶음)`, row));
  const wrap = h('div', 'ww-todo');
  const groups = new Map<string, number[]>();
  p.rows.forEach((r, i) => { const k = (r[iWho] || '').trim() || '(담당 미정)'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i); });
  const isSelf = (who: string) => who.split(/\s*(?:→|->)\s*/)[0].split(/[,·/]/)[0].replace(HONORIFIC_RE, '').trim() === SELF_NAME;
  const ordered = [...groups.entries()].sort((a, b) => Number(isSelf(b[0])) - Number(isSelf(a[0])));
  for (const [who, idxs] of ordered) {
    const g = h('div', 'ww-todo-group');
    const head = h('div', 'ww-todo-who'); head.appendChild(personChips(who)); head.appendChild(h('span', 'ww-todo-cnt', `${idxs.length}건${isSelf(who) ? ' · 본인' : ''}`)); g.appendChild(head);
    const ul = h('ul');
    for (const i of idxs) {
      const r = p.rows[i], li = h('li');
      li.appendChild(h('span', 'ww-box'));
      const body = h('div'); cellInto(body, p.cells[i][iAct]);
      for (const c of memoCols) if ((r[c] || '').trim()) { const m = cellInto(h('span', 'ww-memo'), p.cells[i][c]); if (memoCols.length > 1) m.dataset.label = hs[c]; body.appendChild(m); }
      li.appendChild(body);
      const tl = h('span', 'ww-todo-tail');
      if (iSt >= 0 && r[iSt]) tl.appendChild(statusToken(r[iSt]));
      if (iDue >= 0) tl.appendChild(dateChip(r[iDue] || ''));
      li.appendChild(tl); ul.appendChild(li);
    }
    g.appendChild(ul); wrap.appendChild(g);
  }
  frag.appendChild(wrap);
  return frag;
}

function buildNext(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iWho = R.who, iWhen = R.when, iSt = R.status;
  const nums = numericCols(p);
  const iTitle = hs.findIndex((h, i) => i !== R.idx && !nums.includes(i) && /후속|다음|단계|절차|스텝|step|프로세스|내용|작업|항목/i.test(h) && ![iWho, iWhen, iSt].includes(i));
  const iT = iTitle >= 0 ? iTitle : hs.findIndex((_h, i) => i !== R.idx && !nums.includes(i) && ![iWho, iWhen, iSt].includes(i));
  const stepNo = R.idx >= 0 ? R.idx : hs.findIndex((h, i) => /^(단계|순서|step|no\.?)$/i.test(h) && nums.includes(i));
  const others = hs.map((_h, i) => i).filter(i => ![iT, iWho, iWhen, iSt, stepNo].includes(i));
  const frag = h('div');
  const m = h('span', 'ww-head-m'); if (iWho >= 0) m.appendChild(h('span', 'ww-chip', hs[iWho])); if (iWhen >= 0) m.appendChild(h('span', 'ww-chip', hs[iWhen])); if (iSt >= 0) m.appendChild(h('span', 'ww-st ww-st-need', hs[iSt]));
  frag.appendChild(ghost('ww-head-next', `${hs[iT]} (순서대로)`, m));
  const ol = h('ol', 'ww-next');
  p.rows.forEach((r, i) => {
    const li = h('li', `ww-next-${iSt >= 0 ? (statusKind(r[iSt] || '') || 'need') : 'plain'}`);
    const tt = h('div', 'ww-next-t'); if (stepNo >= 0 && r[stepNo]) tt.appendChild(h('span', 'ww-next-no', r[stepNo])); const tx = h('span'); cellInto(tx, p.cells[i][iT]); tt.appendChild(tx); li.appendChild(tt);
    const meta = h('div', 'ww-next-m');
    if (iWho >= 0 && (r[iWho] || '').trim()) { const w = r[iWho]; if (statusKind(w) === 'done' && w.length <= 3) meta.appendChild(statusToken(w)); else meta.appendChild(personChips(w)); }
    if (iWhen >= 0 && (r[iWhen] || '').trim() && !/^[-—]$/.test(r[iWhen].trim())) meta.appendChild(dateChip(r[iWhen]));
    if (iSt >= 0 && r[iSt]) meta.appendChild(statusToken(r[iSt]));
    for (const c of others) if ((r[c] || '').trim()) meta.appendChild(cellInto(h('span', 'ww-memo'), p.cells[i][c]));
    li.appendChild(meta); ol.appendChild(li);
  });
  frag.appendChild(ol);
  return frag;
}

function buildStatus(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iSt = R.status;
  const iT = hs.findIndex((_h, i) => i !== iSt && i !== R.idx);
  const memoCols = hs.map((_h, i) => i).filter(i => i !== iSt && i !== iT && i !== R.idx);
  const frag = h('div');
  const lg = h('span', 'ww-head-lg');
  (['done', 'run', 'hold', 'need', 'stop'] as StatusKind[]).forEach(k => lg.appendChild(h('span', `ww-st ww-st-${k}`, { done: '완료', run: '진행 중', hold: '보류·대기', need: '검토·미정', stop: '중단·결정 필요' }[k])));
  frag.appendChild(ghost('ww-head-status', ghostCell(hs[iT], memoCols.map(i => hs[i]).join(' · ') || undefined), hs[iSt], lg));
  const ul = h('ul', 'ww-status');
  p.rows.forEach((r, i) => {
    const li = h('li');
    li.appendChild(cellInto(h('span'), p.cells[i][iT]));
    li.appendChild(statusToken(r[iSt] || ''));
    for (const c of memoCols) if ((r[c] || '').replace(/[—-]/g, '').trim()) { const m = cellInto(h('span', 'ww-memo'), p.cells[i][c]); if (memoCols.length > 1) m.dataset.label = hs[c]; li.appendChild(m); }
    ul.appendChild(li);
  });
  frag.appendChild(ul);
  return frag;
}

function buildRating(p: ParsedTable): HTMLElement {
  const nums = numericCols(p).filter(c => c !== 0);
  const iAvg = p.headers.length - 1;
  const crit = nums.filter(c => c !== iAvg);
  const wrap = h('div', 'ww-rating-wrap');
  const grid = h('div', 'ww-rating'); grid.style.gridTemplateColumns = `auto repeat(${crit.length}, minmax(0,1fr)) auto`;
  grid.appendChild(h('div', 'ww-rating-h ww-l', p.headers[0]));
  crit.forEach(c => grid.appendChild(h('div', 'ww-rating-h', p.headers[c].replace(/\s?기여|력$/g, ''))));
  grid.appendChild(h('div', 'ww-rating-h ww-r', p.headers[iAvg]));
  const avgs = p.rows.map(r => isBlank(r[iAvg] || '') ? -1 : parseFloat(r[iAvg]) || 0); const top = Math.max(...avgs);
  const maxScore = Math.max(5, ...p.rows.flatMap(r => crit.map(c => parseFloat(r[c]) || 0)));
  p.rows.forEach((r, i) => {
    grid.appendChild(h('div', 'ww-rating-name', r[0].replace(HONORIFIC_RE, '')));
    if (crit.every(c => isBlank(r[c] || ''))) {
      const na = h('div', 'ww-rating-na', '미평가 (발언 없음)'); na.style.gridColumn = `span ${crit.length + 1}`; grid.appendChild(na);
      return;
    }
    crit.forEach(c => {
      const v = Math.round(parseFloat(r[c]) || 0), sc = h('div', 'ww-rating-sc');
      for (let k = 1; k <= maxScore; k++) sc.appendChild(h('i', k <= v ? 'on' : undefined));
      sc.title = `${p.headers[c]} ${r[c]}`;
      grid.appendChild(sc);
    });
    grid.appendChild(h('div', `ww-rating-avg${avgs[i] === top ? ' ww-top' : ''}`, r[iAvg]));
  });
  wrap.appendChild(grid);
  return wrap;
}

function buildBa(p: ParsedTable): HTMLElement {
  const nums = numericCols(p).filter(c => c !== 0);
  const [ra, rb] = p.rows;
  const frag = h('div');
  const lg = h('span', 'ww-head-lg');
  const la = h('span'); la.appendChild(h('i', 'ww-dot-a')); la.appendChild(document.createTextNode(`${ra[0]} (기존)`));
  const lb = h('span'); lb.appendChild(h('i', 'ww-dot-b')); lb.appendChild(document.createTextNode(`${rb[0]} (이후)`));
  lg.appendChild(la); lg.appendChild(lb);
  frag.appendChild(ghost('ww-head-ba', '지표', lg, '변화'));
  const grid = h('div', 'ww-ba');
  const lowerBetter = (name: string) => /mae|rmse|mape|error|오류|오차|손실|loss|비용|시간|지연|미검출|과검출|불량|결측/i.test(name);
  for (const c of nums) {
    const a = parseFloat(ra[c].replace(/,/g, '')), b = parseFloat(rb[c].replace(/,/g, ''));
    if (!isFinite(a) || !isFinite(b)) continue;
    const lo = Math.min(a, b), hi = Math.max(a, b), rng = hi - lo || 1; const x = (v: number) => 14 + (v - lo) / rng * 72;
    const low = lowerBetter(p.headers[c]); const good = low ? b < a : b > a; const d = a !== 0 ? (b - a) / a * 100 : 0;
    const lb2 = h('div', 'ww-ba-lb', p.headers[c]); lb2.appendChild(h('small', undefined, low ? '낮을수록 좋음' : '높을수록 좋음')); grid.appendChild(lb2);
    const trk = h('div', 'ww-ba-trk');
    trk.appendChild(h('div', 'ww-ba-ln'));
    const seg = h('div', 'ww-ba-seg'); seg.style.left = `${Math.min(x(a), x(b))}%`; seg.style.width = `${Math.abs(x(a) - x(b))}%`; trk.appendChild(seg);
    const va = h('span', 'ww-ba-val ww-a', ra[c]); va.style.left = `${x(a)}%`; trk.appendChild(va);
    const da = h('span', 'ww-ba-dot ww-a'); da.style.left = `${x(a)}%`; trk.appendChild(da);
    const db = h('span', 'ww-ba-dot ww-b'); db.style.left = `${x(b)}%`; trk.appendChild(db);
    const vb = h('span', 'ww-ba-val ww-b', rb[c]); vb.style.left = `${x(b)}%`; trk.appendChild(vb);
    grid.appendChild(trk);
    const delta = h('div', `ww-ba-delta ${a === b ? '' : good ? 'ww-good' : 'ww-bad'}`, `${d > 0 ? '+' : ''}${d.toFixed(1)}%`);
    delta.appendChild(h('small', undefined, a === b ? '변화 없음' : good ? '개선' : '악화'));
    grid.appendChild(delta);
  }
  frag.appendChild(grid);
  return frag;
}

function buildIssues(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iT = hs.findIndex((h, i) => i !== R.idx && /이슈|미결|리스크|문제|블로커|장애|항목|내용/.test(h));
  const iTitle = iT >= 0 ? iT : hs.findIndex((_h, i) => i !== R.idx);
  const iLv = R.level;
  const rest = hs.map((_h, i) => i).filter(i => ![iTitle, iLv, R.idx].includes(i));
  const frag = h('div');
  frag.appendChild(ghost('ww-head-issues', ghostCell(hs[iTitle], [iLv >= 0 ? hs[iLv] : '', ...rest.map(i => hs[i])].filter(Boolean).join(' · '))));
  const ul = h('ul', 'ww-issues');
  const lab = (x: string) => x.replace(/^(추가|기타|주요)\s+/, '').replace(/\s.*$/, '').slice(0, 4);
  const lvClass = (v: string) => /high|높음|상|긴급|critical|심각|1/i.test(v) ? 'ww-lv-high' : /low|낮음|하|경미|3/i.test(v) ? 'ww-lv-low' : 'ww-lv-mid';
  p.rows.forEach((r, i) => {
    const li = h('li');
    const tt = h('div', 'ww-issues-t');
    if (R.idx >= 0 && r[R.idx]) tt.appendChild(h('span', 'ww-dec-n', r[R.idx]));
    const tx = h('span'); cellInto(tx, p.cells[i][iTitle]); tt.appendChild(tx);
    if (iLv >= 0 && (r[iLv] || '').trim()) { const lv = h('span', `ww-chip ww-lv ${lvClass(r[iLv])}`, r[iLv]); tt.appendChild(lv); li.classList.add(lvClass(r[iLv])); }
    li.appendChild(tt);
    for (const c of rest) {
      if (!(r[c] || '').trim()) continue;
      const row = h('div', 'ww-issues-row'); row.appendChild(h('b', undefined, lab(hs[c]))); row.appendChild(cellInto(h('span'), p.cells[i][c])); li.appendChild(row);
    }
    ul.appendChild(li);
  });
  frag.appendChild(ul);
  return frag;
}

function buildTree(p: ParsedTable): HTMLElement {
  const hs = p.headers, n = p.rows.length;
  const filled = (c: number) => p.rows.filter(r => (r[c] || '').trim() !== '').length;
  const repetitive = (c: number) => { let rep = 0; for (let i = 1; i < n; i++) if (p.rows[i][c] === p.rows[i - 1][c]) rep++; return rep >= (n - 1) * 0.4; };
  // 잎 열: 값이 대부분 차 있는 마지막 열. 그 앞에서 연속 반복되는 열들이 묶음, 그 사이 드문드문 찬 열은 칩 앞 라벨.
  let leafCol = hs.length - 1;
  while (leafCol > 1 && filled(leafCol) < n * 0.6) leafCol--;
  const groupCols: number[] = [];
  for (let c = 0; c < leafCol; c++) { if (repetitive(c) && filled(c) >= n * 0.6) groupCols.push(c); else break; }
  const midCols = Array.from({ length: leafCol }, (_unused, i) => i).filter(c => !groupCols.includes(c));
  const extraCols = hs.slice(leafCol + 1).map((_unused, k) => leafCol + 1 + k);
  const frag = h('div');
  const sub = [midCols.length ? `${midCols.map(c => hs[c]).join(', ')}는 칩 앞 라벨` : '', extraCols.length ? `${extraCols.map(c => hs[c]).join(', ')}는 칩 안 작은 글씨` : ''].filter(Boolean).join(' · ');
  frag.appendChild(ghost('ww-head-tree', ghostCell(`${groupCols.map(c => hs[c]).join(' › ')}${groupCols.length ? ' › ' : ''}${hs[leafCol]} (순서대로)`, sub || undefined)));
  const root = h('div', 'ww-tree');
  // 첫 묶음 열이 전부 같은 값이면 제목으로만 쓴다
  let useCols = groupCols;
  if (useCols.length > 1 && p.rows.every(r => r[useCols[0]] === p.rows[0][useCols[0]])) {
    root.appendChild(h('div', 'ww-tree-title', `${hs[useCols[0]]}: ${p.rows[0][useCols[0]]}`));
    useCols = useCols.slice(1);
  }
  type Group = { el: HTMLElement; kids: HTMLElement; children: Map<string, Group>; leaves: HTMLElement | null };
  const mk = (key: string, level: number): Group => {
    const el = h('div', `ww-tree-g ww-tree-g${Math.min(level, 2)}`);
    el.appendChild(h('b', undefined, key));
    const kids = h('div', 'ww-tree-kids'); el.appendChild(kids);
    return { el, kids, children: new Map(), leaves: null };
  };
  const top: Group = { el: root, kids: root, children: new Map(), leaves: null };
  p.rows.forEach((r, i) => {
    let parent = top, level = 0;
    for (const c of useCols) {
      const key = (r[c] || '').trim();
      if (!key) { level++; continue; } // 빈 묶음 값은 그 단계를 건너뛴다
      let g = parent.children.get(key);
      if (!g) { g = mk(key, level); parent.children.set(key, g); parent.kids.appendChild(g.el); }
      parent = g; level++;
    }
    if (!parent.leaves) { parent.leaves = h('div', 'ww-tree-steps'); parent.kids.appendChild(parent.leaves); }
    const chip = h('span');
    const prefix = midCols.map(c => (r[c] || '').trim()).filter(Boolean).join(' · ');
    if (prefix) chip.appendChild(h('em', undefined, prefix));
    const body = h('span'); cellInto(body, p.cells[i][leafCol]); chip.appendChild(body);
    if (p.cells[i][leafCol].querySelector('strong, b')) chip.classList.add('ww-mark');
    const extras = extraCols.map(c => (r[c] || '').replace(/\*/g, '').trim()).filter(Boolean);
    if (extras.length) { chip.classList.add('ww-mark'); chip.appendChild(h('small', undefined, extras.join(' · '))); }
    parent.leaves.appendChild(chip);
  });
  frag.appendChild(root);
  return frag;
}

function buildMap(p: ParsedTable): HTMLElement {
  const hs = p.headers;
  const frag = h('div');
  frag.appendChild(ghost('ww-head-map', hs[0], '→', hs[1], hs.slice(2).join(' · ')));
  const ul = h('ul', 'ww-map');
  p.rows.forEach((r) => {
    const li = h('li'); const same = r[0].trim() === r[1].trim();
    li.appendChild(h('span', `ww-map-old${same ? ' ww-same' : ''}`, r[0]));
    li.appendChild(h('span', 'ww-map-ar', same ? '=' : '→'));
    li.appendChild(h('span', 'ww-map-new', r[1]));
    const stg = h('span', 'ww-map-stg');
    r.slice(2).forEach(v => { const t = v.replace(/[—-]/g, '').replace(/\(.*?추정.*?\)/g, '').trim(); if (t) t.split(/\s*\/\s*/).forEach(x => stg.appendChild(h('span', 'ww-chip', x.replace(/[()]/g, '')))); });
    li.appendChild(stg); ul.appendChild(li);
  });
  frag.appendChild(ul);
  return frag;
}

/** 수치 행렬: 표를 유지하되 첫 열 고정 + 고정폭 숫자 + 열별 최고값(방향은 머리글로 추정) */
function decorateMatrix(table: HTMLTableElement, p: ParsedTable): void {
  table.classList.add('ww-matrix');
  const nums = numericCols(p);
  const lowerBetter = (name: string) => /mae|rmse|mape|error|오류|오차|손실|loss|비용|지연|미검출|과검출|불량|결측/i.test(name);
  for (const c of nums) {
    const vals = p.rows.map(r => parseFloat((r[c] || '').replace(/,/g, '')));
    const finite = vals.filter(v => isFinite(v)); if (finite.length < 2) continue;
    const best = lowerBetter(p.headers[c]) ? Math.min(...finite) : Math.max(...finite);
    p.rows.forEach((_r, i) => { const td = p.cells[i][c]; if (!td) return; td.classList.add('ww-num'); if (vals[i] === best) td.classList.add('ww-best'); });
  }
}

/** 막대: 이름 + 숫자 하나. 최댓값은 강조색, 나머지는 잉크 농도 사다리(참고 시트 6.2). */
function buildBars(p: ParsedTable): HTMLElement {
  const nums = numericCols(p); const iV = nums[0];
  const iName = p.headers.findIndex((_h, i) => i !== iV);
  const memoCols = p.headers.map((_h, i) => i).filter(i => i !== iV && i !== iName);
  const vals = p.rows.map(r => parseFloat((r[iV] || '').replace(/[^\d.\-]/g, '')));
  const max = Math.max(...vals.filter(v => isFinite(v)), 0) || 1;
  const frag = h('div');
  frag.appendChild(ghost('ww-head-bars', p.headers[iName], p.headers[iV] + (memoCols.length ? ` · ${memoCols.map(i => p.headers[i]).join(' · ')}` : '')));
  const list = h('div', 'ww-bars');
  const top = Math.max(...vals.filter(v => isFinite(v)));
  p.rows.forEach((r, i) => {
    const v = vals[i]; const row = h('div', 'ww-bars-row');
    row.appendChild(cellInto(h('div', 'ww-bars-lb'), p.cells[i][iName]));
    const trk = h('div', 'ww-bars-trk'); const bar = h('i', v === top ? 'ww-top' : undefined); bar.style.width = `${isFinite(v) ? Math.max(2, v / max * 100) : 0}%`; trk.appendChild(bar);
    row.appendChild(trk);
    row.appendChild(h('div', 'ww-bars-v', r[iV] || ''));
    if (memoCols.length) { const m = h('div', 'ww-bars-memo'); m.textContent = memoCols.map(c => r[c]).filter(Boolean).join(' · '); row.appendChild(m); }
    list.appendChild(row);
  });
  frag.appendChild(list);
  return frag;
}

/** 비교: 첫 열이 기준, 나머지 열이 선택지. 선택지마다 카드로. */
function buildCompare(p: ParsedTable): HTMLElement {
  const hs = p.headers;
  const frag = h('div');
  frag.appendChild(ghost('ww-head-compare', ghostCell(`${hs[0]}별로 ${hs.length - 1}가지를 나란히`, hs.slice(1).join(' · '))));
  const grid = h('div', 'ww-compare');
  for (let c = 1; c < hs.length; c++) {
    const card = h('div', 'ww-compare-card');
    card.appendChild(h('div', 'ww-compare-h', hs[c]));
    const dl = h('dl');
    p.rows.forEach((r, i) => { dl.appendChild(h('dt', undefined, r[0])); dl.appendChild(cellInto(h('dd'), p.cells[i][c])); });
    card.appendChild(dl); grid.appendChild(card);
  }
  frag.appendChild(grid);
  return frag;
}

/** 카드 목록: 행마다 카드. 첫 글자 열이 제목, 나머지는 라벨 붙은 줄. 담당·기한·상태는 칩으로. */
function buildRecords(p: ParsedTable): HTMLElement {
  const hs = p.headers; const R = columnRoles(p);
  const iTitle = hs.findIndex((_h, i) => i !== R.idx && i !== R.who && i !== R.when && i !== R.status && i !== R.level);
  const rest = hs.map((_h, i) => i).filter(i => ![iTitle, R.idx].includes(i));
  const frag = h('div');
  frag.appendChild(ghost('ww-head-records', ghostCell(hs[iTitle], rest.map(i => hs[i]).join(' · ') || undefined)));
  const ul = h('ul', 'ww-records');
  p.rows.forEach((r, i) => {
    const li = h('li');
    const tt = h('div', 'ww-records-t');
    if (R.idx >= 0 && r[R.idx]) tt.appendChild(h('span', 'ww-dec-n', r[R.idx]));
    const tx = h('span'); cellInto(tx, p.cells[i][iTitle]); tt.appendChild(tx);
    li.appendChild(tt);
    const chips = h('div', 'ww-records-chips');
    if (R.who >= 0 && (r[R.who] || '').trim()) chips.appendChild(personChips(r[R.who]));
    if (R.when >= 0 && (r[R.when] || '').trim()) chips.appendChild(dateChip(r[R.when]));
    if (R.status >= 0 && (r[R.status] || '').trim()) chips.appendChild(statusToken(r[R.status]));
    if (R.level >= 0 && (r[R.level] || '').trim()) chips.appendChild(h('span', 'ww-chip ww-lv', r[R.level]));
    if (chips.childNodes.length) li.appendChild(chips);
    for (const c of rest) {
      if ([R.who, R.when, R.status, R.level].includes(c)) continue;
      if (!(r[c] || '').replace(/[—-]/g, '').trim()) continue;
      const row = h('div', 'ww-records-row'); row.appendChild(h('b', undefined, hs[c].slice(0, 6))); row.appendChild(cellInto(h('span'), p.cells[i][c])); li.appendChild(row);
    }
    ul.appendChild(li);
  });
  frag.appendChild(ul);
  return frag;
}

/** 표 → 섬 DOM. matrix 는 표 자체를 꾸미고 null 을 돌려준다(교체 없음). */
export function buildTableIsland(table: HTMLTableElement, kind: TableIslandKind, p: ParsedTable): HTMLElement | null {
  switch (kind) {
    case 'kv': return buildKv(p);
    case 'dec': return buildDec(p);
    case 'todo': return buildTodo(p);
    case 'next': return buildNext(p);
    case 'status': return buildStatus(p);
    case 'rating': return buildRating(p);
    case 'ba': return buildBa(p);
    case 'issues': return buildIssues(p);
    case 'tree': return buildTree(p);
    case 'map': return buildMap(p);
    case 'matrix': decorateMatrix(table, p); return null;
    case 'bars': return buildBars(p);
    case 'compare': return buildCompare(p);
    case 'records': return buildRecords(p);
  }
}
