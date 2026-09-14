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

export type TableIslandKind = 'kv' | 'dec' | 'todo' | 'next' | 'status' | 'rating' | 'ba' | 'issues' | 'tree' | 'map' | 'matrix';

export const TABLE_KIND_LABEL: Record<TableIslandKind, string> = {
  kv: '사실 목록', dec: '결정 목록', todo: '체크리스트', next: '세로 궤도', status: '상태 목록',
  rating: '점 격자', ba: '이전·이후', issues: '사안 목록', tree: '묶음 개요', map: '이름 바꿈', matrix: '수치 행렬',
};

export interface ParsedTable { headers: string[]; rows: string[][]; cells: HTMLElement[][] }

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

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

function numericCols(p: ParsedTable): number[] {
  const out: number[] = [];
  for (let c = 0; c < p.headers.length; c++) {
    const vals = p.rows.map(r => r[c] || '').filter(v => v !== '');
    if (vals.length >= Math.max(1, p.rows.length * 0.7) && vals.every(isNum)) out.push(c);
  }
  return out;
}

const find = (hs: string[], re: RegExp): number => hs.findIndex(h => re.test(h));

export function classifyTable(p: ParsedTable): TableIslandKind | null {
  const hs = p.headers, cols = hs.length, n = p.rows.length;
  const nums = numericCols(p);
  // 점 격자: 발언자/평가자 + 숫자 열 5개 이상 + 평균
  if (/발언자|평가자|이름|참석자/.test(hs[0]) && nums.length >= 5 && /평균|합계|점수/.test(hs[cols - 1])) return 'rating';
  // 이전·이후: 행 2개, 숫자 열 2~4개, 첫 열은 글자
  if (n === 2 && nums.length >= 2 && nums.length <= 4 && !nums.includes(0)) return 'ba';
  // 수치 행렬: 숫자 열 4개 이상
  if (nums.length >= 4) return 'matrix';
  // 세로 궤도: 후속/다음 + 담당 + 일정 + 상태
  if (/후속|다음|단계|작업/.test(hs[0]) && find(hs, /담당/) >= 0 && find(hs, /일정|시점|기한|예상/) >= 0 && find(hs, /상태/) >= 0) return 'next';
  // 체크리스트: 담당 + 액션 + 기한
  if (find(hs, /담당/) >= 0 && find(hs, /액션|행동|action|할\s?일|작업|내용/i) >= 0 && find(hs, /기한|일정|due|마감|시점/i) >= 0) return 'todo';
  // 결정 목록: # + 결정 + 조건
  if (cols === 3 && /^(#|번호|no\.?|순번)$/i.test(hs[0]) && /결정|내용/.test(hs[1])) return 'dec';
  if (cols === 3 && /^(구분|분류)$/.test(hs[0]) && /결정/.test(hs[1]) && /조건|범위/.test(hs[2])) return 'dec';
  // 이름 바꿈: 구 → 신
  if (cols >= 2 && /^(구|舊|기존|이전|as-?is|현재)/i.test(hs[0]) && /^(신|新|변경|신규|이후|to-?be)/i.test(hs[1])) return 'map';
  // 사안 목록: 미결/리스크/이슈 + (상태|설명) + (검토|영향|대응)
  if (cols === 3 && /미결|리스크|이슈|문제|블로커/.test(hs[0]) && (/상태|설명|현황|내용/.test(hs[1]) || /검토|영향|대응|필요|비고/.test(hs[2]))) return 'issues';
  // 상태 목록: 상태 열 + 값이 상태 낱말
  const stIdx = find(hs, /^상태$|진행\s?상태|status/i);
  if (stIdx >= 0 && cols <= 4 && p.rows.every(r => statusKind(r[stIdx] || '') !== null)) return 'status';
  // 묶음 개요: 앞 열 2개 이상이 연속 반복
  if (cols >= 4 && n >= 6) {
    let rep = 0;
    for (let i = 1; i < n; i++) if (p.rows[i][0] === p.rows[i - 1][0] && p.rows[i][1] === p.rows[i - 1][1]) rep++;
    if (rep >= (n - 1) * 0.6) return 'tree';
  }
  // 사실 목록: 2열 + 항목/구분 류 머리글
  if (cols === 2 && /^(항목|구분|설정|지표|필드|속성|키|key|영역|분류|대상|실행 계획|화면 영역)$/i.test(hs[0]) && n <= 20) return 'kv';
  return null;
}

export type StatusKind = 'done' | 'run' | 'hold' | 'need' | 'stop';

export function statusKind(s: string): StatusKind | null {
  const v = s.replace(EMOJI_RE, '').trim();
  if (!v) return null;
  if (/완료|done|closed|해결|반영됨|회신됨/i.test(v)) return 'done';
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
  const parts = text.split(/[,·/]|\s및\s|\s와\s|\s과\s/).map(s => s.trim()).filter(Boolean);
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
  const frag = h('div');
  frag.appendChild(ghost('ww-head-dec', p.headers[0], ghostCell(p.headers[1], p.headers[2])));
  const ol = h('ol', 'ww-dec');
  p.rows.forEach((r, i) => {
    const li = h('li'); const box = h('div');
    li.appendChild(h('span', 'ww-dec-n', r[0]));
    box.appendChild(cellInto(h('div', 'ww-dec-d'), p.cells[i][1]));
    if ((r[2] || '').trim()) box.appendChild(cellInto(h('div', 'ww-dec-c'), p.cells[i][2]));
    li.appendChild(box); ol.appendChild(li);
  });
  frag.appendChild(ol);
  return frag;
}

function buildTodo(p: ParsedTable): HTMLElement {
  const hs = p.headers;
  const iWho = find(hs, /담당/), iAct = find(hs, /액션|행동|action|할\s?일|작업|내용/i), iDue = find(hs, /기한|일정|due|마감|시점/i);
  const iMemo = hs.findIndex((x, i) => i !== iWho && i !== iAct && i !== iDue && !/상태/.test(x) && !/^(#|no\.?|번호|순번)$/i.test(x));
  const iSt = find(hs, /상태/);
  const frag = h('div');
  const row = h('span', 'ww-head-row'); row.appendChild(h('i', 'ww-box')); row.appendChild(ghostCell(hs[iAct], iMemo >= 0 ? hs[iMemo] : undefined)); row.appendChild(h('span', 'ww-chip', hs[iDue]));
  frag.appendChild(ghost('ww-head-todo', `${hs[iWho]} (묶음)`, row));
  const wrap = h('div', 'ww-todo');
  const groups = new Map<string, number[]>();
  p.rows.forEach((r, i) => { const k = r[iWho] || '(담당 미정)'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i); });
  for (const [who, idxs] of groups) {
    const g = h('div', 'ww-todo-group');
    const head = h('div', 'ww-todo-who'); head.appendChild(personChips(who)); head.appendChild(h('span', 'ww-todo-cnt', `${idxs.length}건`)); g.appendChild(head);
    const ul = h('ul');
    for (const i of idxs) {
      const r = p.rows[i], li = h('li');
      li.appendChild(h('span', 'ww-box'));
      const body = h('div'); cellInto(body, p.cells[i][iAct]);
      if (iMemo >= 0 && (r[iMemo] || '').trim()) body.appendChild(cellInto(h('span', 'ww-memo'), p.cells[i][iMemo]));
      li.appendChild(body);
      const tail = h('span', 'ww-todo-tail');
      if (iSt >= 0 && r[iSt]) tail.appendChild(statusToken(r[iSt]));
      tail.appendChild(dateChip(r[iDue] || ''));
      li.appendChild(tail); ul.appendChild(li);
    }
    g.appendChild(ul); wrap.appendChild(g);
  }
  frag.appendChild(wrap);
  return frag;
}

function buildNext(p: ParsedTable): HTMLElement {
  const hs = p.headers;
  const iWho = find(hs, /담당/), iWhen = find(hs, /일정|시점|기한|예상/), iSt = find(hs, /상태/);
  const frag = h('div');
  const m = h('span', 'ww-head-m'); m.appendChild(h('span', 'ww-chip', hs[iWho])); m.appendChild(h('span', 'ww-chip', hs[iWhen])); m.appendChild(h('span', 'ww-st ww-st-need', hs[iSt]));
  frag.appendChild(ghost('ww-head-next', `${hs[0]} (순서대로)`, m));
  const ol = h('ol', 'ww-next');
  p.rows.forEach((r, i) => {
    const li = h('li', `ww-next-${statusKind(r[iSt] || '') || 'need'}`);
    li.appendChild(cellInto(h('div', 'ww-next-t'), p.cells[i][0]));
    const meta = h('div', 'ww-next-m');
    meta.appendChild(personChips(r[iWho] || ''));
    meta.appendChild(dateChip(r[iWhen] || ''));
    if (r[iSt]) meta.appendChild(statusToken(r[iSt]));
    li.appendChild(meta); ol.appendChild(li);
  });
  frag.appendChild(ol);
  return frag;
}

function buildStatus(p: ParsedTable): HTMLElement {
  const hs = p.headers;
  const iSt = find(hs, /^상태$|진행\s?상태|status/i);
  const iMemo = hs.findIndex((_unused, i) => i !== 0 && i !== iSt);
  const frag = h('div');
  const lg = h('span', 'ww-head-lg');
  (['done', 'run', 'hold', 'need', 'stop'] as StatusKind[]).forEach(k => lg.appendChild(h('span', `ww-st ww-st-${k}`, { done: '완료', run: '진행 중', hold: '보류·대기', need: '검토·미정', stop: '중단·결정 필요' }[k])));
  frag.appendChild(ghost('ww-head-status', ghostCell(hs[0], iMemo >= 0 ? hs[iMemo] : undefined), hs[iSt], lg));
  const ul = h('ul', 'ww-status');
  p.rows.forEach((r, i) => {
    const li = h('li');
    li.appendChild(cellInto(h('span'), p.cells[i][0]));
    li.appendChild(statusToken(r[iSt] || ''));
    if (iMemo >= 0 && (r[iMemo] || '').replace(/[—-]/g, '').trim()) li.appendChild(cellInto(h('span', 'ww-memo'), p.cells[i][iMemo]));
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
  const avgs = p.rows.map(r => parseFloat(r[iAvg]) || 0); const top = Math.max(...avgs);
  const maxScore = Math.max(5, ...p.rows.flatMap(r => crit.map(c => parseFloat(r[c]) || 0)));
  p.rows.forEach((r, i) => {
    grid.appendChild(h('div', 'ww-rating-name', r[0].replace(HONORIFIC_RE, '')));
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
  const hs = p.headers;
  const frag = h('div');
  frag.appendChild(ghost('ww-head-issues', ghostCell(hs[0], `${hs[1]} · ${hs[2]}`)));
  const ul = h('ul', 'ww-issues');
  const lab = (x: string) => x.replace(/\s.*$/, '').slice(0, 4);
  p.rows.forEach((r, i) => {
    const li = h('li');
    li.appendChild(cellInto(h('div', 'ww-issues-t'), p.cells[i][0]));
    for (const c of [1, 2]) {
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
  }
}
