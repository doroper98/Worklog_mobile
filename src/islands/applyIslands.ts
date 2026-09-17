/**
 * applyIslands — 렌더된 마크다운 컨테이너(.md-content)의 표와 mermaid 블록을 "섬"으로 바꾼다.
 *
 * v3.87.0: 마크다운 섬 도입.
 *  - 원문 마크다운은 손대지 않는다(LLM 출력·저장 파일·위키·검색 그대로).
 *  - 블록마다 [섬 | 표] / [draw.io | Mermaid] 스위치를 붙인다.
 *  - v3.99.2: 선택은 **마크다운 문서의 표식**에 남는다(`viewMarkers.ts`). 이 PC 의 localStorage 가
 *    아니라 문서라서 모바일에서도 같은 보기가 나온다. 표식이 없으면 표는 역할별 기본값
 *    (`defaultTableView`), 흐름도는 draw.io/섬 보기다. 예전 localStorage 선택은 첫 렌더에 1회 이전한다.
 *  - LLM 이 `<table class="raw">` 를 붙이면 항상 표, `class="ww-kv"` 류를 붙이면 그 섬으로 강제.
 *  - 원본 표는 DOM 에서 떼어 두고(WeakMap) 스위치로 되돌린다. 숨긴 채 두지 않는 이유는
 *    Ctrl+F 검색이 보이지 않는 원본까지 세지 않게 하기 위해서다.
 *  - mermaid 블록(.mermaid-diagram)은 기존 렌더 effect 가 그대로 그리도록 DOM 에 남기고,
 *    섬 보기일 때는 hidden 으로만 감춘다.
 *  - 복사(Outlook)용으로 prepareCloneForCopy 를 제공: 표 섬은 원본 표로 되돌리고,
 *    흐름 섬은 보이는 쪽(SVG 또는 Mermaid)만 남긴다.
 */
import { parseTable, classifyTable, buildTableIsland, TABLE_KIND_LABEL, setSelfName, parsePriorityTable, defaultTableView } from './tableIslands';
import { mermaidViewOf, tableViewOfComment, normHeaderCell } from './viewMarkers';
import type { TableIslandKind } from './tableIslands';
import { parseFlowchart, sameFlowGraph } from './mermaidFlowParser';
import type { FlowGraph } from './mermaidFlowParser';
import { classifyFlow, renderFlowIsland, renderGraphElk, FLOW_KIND_LABEL } from './flowIslands';
import { islandToDrawio, paletteFromTokens, recolorXml, extractMxfileFromSvgText, drawioSlugOf } from './drawioExport';
import { resolveIslandTokens } from './islandTokens';
import { renderDrawioXml } from './drawioViewer';
import type { FlowIslandKind, CauseExtra, ElkLike } from './flowIslands';
import { invalidateIslandTokens } from './islandTokens';
import { parseGantt, renderGantt, parseSequence, buildSequence } from './mermaidOthers';
import type { GanttModel } from './mermaidOthers';

export type IslandView = 'island' | 'raw';

const DEFAULT_KEY = 'workwiki.islands.default';
const VIEW_KEY = 'workwiki.islands.view';
const VIEW_CAP = 600;

/** v3.99.2: 바뀐 보기를 **마크다운 문서**의 어느 블록에 적을지 가리키는 값.
 *  표는 머리글 + 같은 머리글 중 몇 번째인지로, 흐름도는 Mermaid 원문으로 찾는다. */
export type BlockRef =
  | { kind: 'table'; headers: string[]; index: number }
  | { kind: 'mermaid'; src: string };

const blockRefs = new WeakMap<HTMLElement, BlockRef>();
/** 클릭 위임은 컨테이너당 한 번만 붙으므로, 최신 옵션(콜백)은 여기서 꺼내 쓴다 */
const liveOpts = new WeakMap<HTMLElement, ApplyOptions>();

/** DOM 표의 머리글 — 마크다운 원문과 맞추려고 같은 규칙으로 정규화한다 */
function headersOfTable(table: Element): string[] {
  const row = table.querySelector('tr');
  return row ? Array.from(row.children).map(c => normHeaderCell(c.textContent || '')) : [];
}

/** 표 바로 윗줄의 `<!-- ww:view=… -->` 주석(공백 텍스트 노드는 건너뛴다) */
function tableMarkerView(table: Element): IslandView | null {
  let n: Node | null = table.previousSibling;
  while (n && n.nodeType === Node.TEXT_NODE && !(n.nodeValue || '').trim()) n = n.previousSibling;
  if (!n || n.nodeType !== Node.COMMENT_NODE) return null;
  return tableViewOfComment(n.nodeValue || '');
}

export function getIslandsDefault(): IslandView {
  try { return localStorage.getItem(DEFAULT_KEY) === 'raw' ? 'raw' : 'island'; } catch { return 'island'; }
}
export function setIslandsDefault(v: IslandView): void {
  try { localStorage.setItem(DEFAULT_KEY, v); } catch { /* ignore */ }
}

function readViews(): Record<string, IslandView> {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return {};
    const obj: unknown = JSON.parse(raw);
    if (obj && typeof obj === 'object') return obj as Record<string, IslandView>;
  } catch { /* ignore */ }
  return {};
}
function writeView(key: string, v: IslandView | null): void {
  try {
    const m = readViews();
    if (v === null) delete m[key]; else m[key] = v;
    const keys = Object.keys(m);
    if (keys.length > VIEW_CAP) for (const k of keys.slice(0, keys.length - VIEW_CAP)) delete m[k];
    localStorage.setItem(VIEW_KEY, JSON.stringify(m));
  } catch { /* ignore */ }
}

const rawTables = new WeakMap<HTMLElement, HTMLTableElement>();
const islandNodes = new WeakMap<HTMLElement, HTMLElement>();
export type ElkLoader = () => Promise<ElkLike>;
const flowGraphs = new WeakMap<HTMLElement, { graph?: FlowGraph; kind: FlowIslandKind | 'gantt' | 'sequence'; extra?: CauseExtra; gantt?: GanttModel; elk?: ElkLoader;
  /** v3.99.1: 이 블록의 Mermaid 원문(편집본 연결 표시 `%% drawio: <slug>` 를 읽는다) */
  src?: string;
  /** v3.99.1: draw.io 뷰(데스크톱). 없으면 섬 SVG 뷰(모바일·하네스) */
  drawio?: DrawioViewOptions;
}>();
const OTHER_LABEL: Record<'gantt' | 'sequence', string> = { gantt: '일정', sequence: '순서' };

/** ```mermaid 블록의 원문(렌더 전처리본). `%% drawio:` 표시를 읽는 데 쓴다 */
function srcOf(div: HTMLElement): string {
  try { return decodeURIComponent(div.dataset.mermaidSrc || ''); } catch { return div.dataset.mermaidSrc || ''; }
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;
}

function makeSwitch(rawLabel: string, islandLabel = '섬'): HTMLElement {
  const sw = el('div', 'ww-sw'); sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', '표시 방식');
  const a = el('button', undefined, islandLabel) as HTMLButtonElement; a.dataset.wwView = 'island'; a.type = 'button';
  const b = el('button', undefined, rawLabel) as HTMLButtonElement; b.dataset.wwView = 'raw'; b.type = 'button';
  sw.appendChild(a); sw.appendChild(b);
  return sw;
}

function setSwitch(wrapper: HTMLElement, view: IslandView): void {
  wrapper.dataset.wwCurrent = view;
  wrapper.querySelectorAll<HTMLButtonElement>('.ww-sw button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.wwView === view)));
}

function applyTableView(wrapper: HTMLElement, view: IslandView): void {
  const body = wrapper.querySelector<HTMLElement>('.ww-body'); const raw = rawTables.get(wrapper);
  if (!body || !raw) return;
  const island = wrapper.querySelector<HTMLElement>('.ww-island-content');
  if (view === 'raw') { if (island) island.remove(); if (!raw.isConnected) body.appendChild(raw); }
  else { if (raw.isConnected) raw.remove(); const isl = islandNodes.get(wrapper); if (isl && !isl.isConnected) body.appendChild(isl); }
  setSwitch(wrapper, view);
}

/** 이미 만든 섬을 전부 원본으로 되돌린다 (전역 토글 OFF/ON 전환용). 원본 표는 자리로 복귀, mermaid div 는 wrapper 밖으로. */
export function resetIslands(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('.ww-island').forEach(w => {
    if (w.dataset.wwFlow) {
      const div = w.querySelector<HTMLElement>('.mermaid-diagram');
      if (div) { delete div.dataset.wwDone; w.parentNode?.insertBefore(div, w); }
    } else {
      const raw = rawTables.get(w);
      if (raw) { delete raw.dataset.wwDone; w.parentNode?.insertBefore(raw, w); }
    }
    w.remove();
  });
  container.querySelectorAll<HTMLTableElement>('table.ww-matrix').forEach(t => {
    t.classList.remove('ww-matrix'); delete t.dataset.wwDone;
    t.querySelectorAll('.ww-best, .ww-num').forEach(c => { c.classList.remove('ww-best'); c.classList.remove('ww-num'); });
  });
  container.querySelectorAll<HTMLElement>('.mermaid-diagram[data-ww-done]').forEach(d => { delete d.dataset.wwDone; });
  container.querySelectorAll<HTMLElement>('table[data-ww-done]').forEach(d => { delete d.dataset.wwDone; });
}

function applyFlowView(wrapper: HTMLElement, view: IslandView): void {
  const stage = wrapper.querySelector<HTMLElement>('.ww-flow-stage'); const raw = wrapper.querySelector<HTMLElement>('.ww-raw');
  if (stage) stage.hidden = view === 'raw';
  if (raw) raw.hidden = view !== 'raw';
  setSwitch(wrapper, view);
}

/** v3.99.0: 데스크톱 넓은 배치의 최소 그리기 폭과 축소 하한.
 *  640 미만으로 그리면 분기 궤도가 폰 배치로 떨어진다(`drawBranch` 는 520 미만에서 narrow). */
const WIDE_MIN = 640;
const WIDE_MIN_SCALE = 0.72;

/** 넓게 그린 SVG 를 무대 폭에 맞춘다.
 *  - 무대보다 좁거나 같으면 그대로
 *  - 축소비가 0.72 이상이면 `width=100%` + `height=auto` 로 줄여 맞춘다(viewBox 는 이미 있다)
 *  - 그보다 작아져야 하면 줄이지 않고 자연 크기 유지 → `.ww-flow-stage` 의 가로 스크롤
 *  글자 크기 고정 원칙의 예외이며 데스크톱 한정이다. */
function fitWide(svg: string, stageW: number): string {
  const m = /^<svg\b[^>]*\bwidth="([0-9.]+)"/.exec(svg);
  if (!m) return svg;
  const natural = parseFloat(m[1]);
  if (!(natural > stageW)) return svg;
  if (stageW / natural < WIDE_MIN_SCALE) return svg;        // 너무 작아진다 → 가로 스크롤
  return svg.replace(/^(<svg\b[^>]*?)\swidth="[0-9.]+"\sheight="([0-9.]+)"/,
    '$1 width="100%" height="auto" data-ww-natural="' + natural + 'x$2"');
}

/** v3.99.1: 흐름도 블록을 draw.io 뷰어로 그린다. XML 은 편집본이 있으면 그 파일, 없으면 섬 배치로 즉석 생성.
 *  파일 저장도 LLM 호출도 네트워크도 없다. 실패하면 Mermaid 렌더로 물러난다(섬 아님). */
async function drawDrawio(wrapper: HTMLElement, stage: HTMLElement): Promise<void> {
  const info = flowGraphs.get(wrapper);
  if (!info || !info.graph || info.kind === 'gantt' || info.kind === 'sequence' || !info.drawio) return;
  const seq = (Number(stage.dataset.wwDseq) || 0) + 1; stage.dataset.wwDseq = String(seq);
  const graph = info.graph, kind = info.kind;
  try {
    const tokens = resolveIslandTokens();
    const palette = paletteFromTokens(tokens);
    let xml = '';
    const slug = info.src ? drawioSlugOf(info.src) : null;
    if (slug && info.drawio.readDiagram) {
      const svgText = await info.drawio.readDiagram(slug);
      const mx = svgText ? extractMxfileFromSvgText(svgText) : '';
      // 편집본은 다른 테마에서 저장됐을 수 있다 → 역할(wwRole)대로 현재 테마 색을 덮어쓴다(v3.99.4)
      if (mx) xml = recolorXml(mx, palette);
    }
    if (!xml) {
      const svg = kind === 'graph' && info.elk
        ? await renderGraphElk(graph, 780, await info.elk())
        : renderFlowIsland(graph, kind, 780, info.extra);
      xml = islandToDrawio(svg, graph, { font: palette.font, palette });
    }
    if (stage.dataset.wwDseq !== String(seq) || !stage.isConnected) return;
    await renderDrawioXml(stage, xml);
  } catch (e) {
    // 뷰어를 못 읽었거나 변환이 실패했다 → Mermaid 원본 보기로
    console.warn('[islands] draw.io 뷰 실패 — Mermaid 로 보여 줍니다:', e);
    applyFlowView(wrapper, 'raw'); setSwitch(wrapper, 'raw');
  }
}

function drawFlow(wrapper: HTMLElement): void {
  const info = flowGraphs.get(wrapper); const stage = wrapper.querySelector<HTMLElement>('.ww-flow-stage');
  if (!info || !stage) return;
  if (info.drawio && info.graph && info.kind !== 'gantt' && info.kind !== 'sequence') { void drawDrawio(wrapper, stage); return; }
  const stageW = Math.max(240, (stage.clientWidth || wrapper.clientWidth || 600) - 20);
  // v3.99.0: 데스크톱(layout:'wide')은 무대가 좁아도 넓은 배치로 그리고 축소해 맞춘다(폰 배치는 모바일만)
  const wide = wrapper.dataset.wwLayout === 'wide';
  const width = wide ? Math.max(stageW, WIDE_MIN) : stageW;
  const fit = (svg: string) => (wide ? fitWide(svg, stageW) : svg);
  if (info.kind === 'gantt') { if (info.gantt) stage.innerHTML = renderGantt(info.gantt, stageW); return; }
  if (info.kind === 'sequence') return; // DOM 은 처음 한 번만 만든다
  if (!info.graph) return;
  stage.innerHTML = fit(renderFlowIsland(info.graph, info.kind, width, info.extra));
  if (info.kind === 'graph' && info.elk) {
    // 관계 그래프: 층별 지도로 먼저 보이고, ELK 배치가 끝나면 바꿔 끼운다(늦게 온 결과는 버림)
    const seq = (Number(stage.dataset.wwSeq) || 0) + 1; stage.dataset.wwSeq = String(seq);
    const graph = info.graph;
    info.elk().then(elk => renderGraphElk(graph, width, elk)).then(svg => { if (stage.dataset.wwSeq === String(seq) && stage.isConnected) stage.innerHTML = fit(svg); }).catch(() => { /* ELK 실패 → 층별 지도 유지 */ });
  }
}

/** v3.99.1: draw.io 뷰 설정 */
export interface DrawioViewOptions {
  /** 편집본 읽기 — `%% drawio: <slug>` 가 있을 때 그 `.drawio.svg` 텍스트를 돌려준다(없으면 null) */
  readDiagram?: (slug: string) => Promise<string | null>;
  /** v3.99.3: 편집기로 열기 — 상단 바 `✎ 편집` 버튼과 무대 더블클릭이 부른다.
   *  넘기지 않으면 버튼을 그리지 않는다(읽기 전용 화면). 인자는 그 블록의 Mermaid 원문. */
  onEdit?: (src: string) => void;
}

export interface ApplyOptions {
  /** 문서 식별 키 (블록별 선택 기억용). 예: `${date}|${title}` */
  docKey: string;
  /** false 면 섬을 만들지 않고 이미 만든 것도 원본으로 되돌린다. */
  enabled?: boolean;
  /** 본인 이름 (체크리스트에서 본인 묶음을 맨 위로). 없으면 앱 주체자 기본값. */
  self?: string;
  /** v3.92.0: Mermaid 자체 파서로 flowchart 를 읽는 비동기 경로(앱 안의 라이브러리 호출, 외부 전송 없음).
   *  있으면 동기 정규식 파서 결과로 먼저 그린 뒤, 결과가 다르면 이 그래프로 바꿔 그린다. 실패(null)면 동기 결과 유지. */
  parseFlow?: (src: string) => Promise<FlowGraph | null>;
  /** v3.92.0: 관계 그래프(graph) 배치용 elkjs 로더(`() => import('elkjs/lib/elk.bundled.js').then(m => new m.default())`). 없으면 층별 지도. */
  elk?: ElkLoader;
  /** v3.99.2: 블록의 보기를 바꿨을 때 부른다 — **마크다운 문서에 표식을 남기는** 자리.
   *  넘기지 않으면 화면만 바뀌고 저장되지 않는다(미리보기 팝업·검색 상세).
   *  localStorage 이전(1회)도 이 콜백으로 이뤄지므로, 넘기지 않으면 이전도 하지 않는다. */
  onViewChange?: (ref: BlockRef, view: IslandView) => void;
  /** v3.99.1: flowchart 블록을 **draw.io 뷰어**로 그린다(데스크톱).
   *  넘기지 않으면 예전대로 섬 SVG 뷰다(모바일·하네스 호환). 표 섬·간트·순서도는 영향 없음. */
  drawioView?: DrawioViewOptions;
  /** v3.99.0: 흐름 섬 배치.
   *  `'auto'`(기본) = 무대 폭으로 결정(좁으면 폰 배치) — 모바일은 이 값을 쓴다.
   *  `'wide'` = 폭과 무관하게 넓은 배치로 그리고 무대보다 넓으면 축소해 맞춘다(데스크톱). */
  layout?: 'auto' | 'wide';
}

/** 컨테이너에 섬을 적용한다. 반환값은 정리 함수(옵저버 해제). 재호출은 멱등. */
export function applyIslands(container: HTMLElement, opts: ApplyOptions): () => void {
  const enabled = opts.enabled !== false;
  if (opts.self) setSelfName(opts.self);
  const def = getIslandsDefault();
  const views = readViews();
  const cleanups: Array<() => void> = [];
  liveOpts.set(container, opts);
  /** v3.99.2: 표식이 없고 예전 localStorage 선택이 있는 블록 — 첫 렌더에 문서로 옮긴다 */
  const migrations: Array<{ wrapper: HTMLElement; view: IslandView; key: string }> = [];
  /** 문서 표식 → 예전 선택(1회 이전) → 기본값 순으로 첫 보기를 정한다 */
  const initialView = (wrapper: HTMLElement, marker: IslandView | null, key: string, fallback: IslandView): IslandView => {
    if (marker) return marker;
    const old = views[key];
    if ((old === 'island' || old === 'raw') && opts.onViewChange) { migrations.push({ wrapper, view: old, key }); return old; }
    return fallback;
  };
  resetIslands(container);

  // 클릭 위임 (컨테이너당 1회)
  if (!container.dataset.wwBound) {
    container.dataset.wwBound = '1';
    container.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('.ww-sw button');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      const wrapper = btn.closest<HTMLElement>('.ww-island'); if (!wrapper) return;
      const view: IslandView = btn.dataset.wwView === 'raw' ? 'raw' : 'island';
      if (wrapper.dataset.wwFlow) { applyFlowView(wrapper, view); if (view === 'island') drawFlow(wrapper); }
      else applyTableView(wrapper, view);
      // v3.99.2: 선택은 localStorage 가 아니라 **문서 표식**으로 남긴다(모바일도 같은 문서를 읽는다)
      const ref = blockRefs.get(wrapper);
      const live = liveOpts.get(container);
      if (ref && live?.onViewChange) live.onViewChange(ref, view);
    });
  }

  // ── 표 ──
  const tables = Array.from(container.querySelectorAll<HTMLTableElement>('.md-content table'));
  // 같은 머리글이 여러 번 나오면 몇 번째인지로 구분한다(문서에서 그 표를 찾을 때 쓴다)
  const tableOrder = new Map<HTMLTableElement, number>();
  const seenHeaders = new Map<string, number>();
  for (const t of tables) {
    const sig = headersOfTable(t).join('|');
    const n = seenHeaders.get(sig) ?? 0;
    seenHeaders.set(sig, n + 1); tableOrder.set(t, n);
  }
  tables.forEach((table, i) => {
    if (table.dataset.wwDone) return;
    table.dataset.wwDone = '1';
    if (!enabled) return;
    if (table.classList.contains('raw') || table.closest('.ww-island')) return;
    const p = parseTable(table); if (!p) return;
    const marker = tableMarkerView(table);   // 문서 표식(있으면 무조건 이것)
    const forced = Array.from(table.classList).find(c => c.startsWith('ww-'))?.slice(3) as TableIslandKind | undefined;
    const kind = forced && forced in TABLE_KIND_LABEL ? forced : classifyTable(p);
    if (!kind) return;
    const island = buildTableIsland(table, kind, p);
    if (!island) return; // matrix: 표 자체를 꾸몄음
    island.classList.add('ww-island-content');
    const wrapper = el('div', 'ww-island'); wrapper.dataset.wwKind = kind;
    const key = `${opts.docKey}#t${i}:${p.headers.join('|').slice(0, 60)}`; wrapper.dataset.wwKey = key;
    const top = el('div', 'ww-top'); top.title = TABLE_KIND_LABEL[kind]; top.appendChild(makeSwitch('표'));
    const body = el('div', 'ww-body');
    wrapper.appendChild(top); wrapper.appendChild(body);
    table.parentNode?.insertBefore(wrapper, table);
    table.remove(); rawTables.set(wrapper, table); islandNodes.set(wrapper, island);
    blockRefs.set(wrapper, { kind: 'table', headers: headersOfTable(table), index: tableOrder.get(table) ?? 0 });
    // 표식이 없으면 표의 **역할**로 기본값을 정한다(v3.99.2)
    const fallback: IslandView = def === 'raw' ? 'raw' : (defaultTableView(kind, p) === 'island' ? 'island' : 'raw');
    applyTableView(wrapper, initialView(wrapper, marker, key, fallback));
  });

  // ── mermaid ──
  const diagrams = Array.from(container.querySelectorAll<HTMLElement>('.mermaid-diagram'));
  diagrams.forEach((div, i) => {
    if (div.dataset.wwDone) return;
    div.dataset.wwDone = '1';
    if (!enabled) return;
    if (div.closest('.ww-island')) return;
    const src = decodeURIComponent(div.dataset.mermaidSrc || '');
    const headLine = src.split('\n').map(l => l.trim()).find(l => l && !l.startsWith('%%')) || '';
    // gantt / sequenceDiagram 은 별도 렌더러
    if (/^gantt\b/.test(headLine) || /^sequenceDiagram\b/.test(headLine)) {
      const isGantt = /^gantt\b/.test(headLine);
      const gantt = isGantt ? parseGantt(src) : null; const seq = isGantt ? null : parseSequence(src);
      if (!gantt && !seq) return;
      const okind: 'gantt' | 'sequence' = isGantt ? 'gantt' : 'sequence';
      const wrapper = el('div', 'ww-island ww-island-flow'); wrapper.dataset.wwKind = okind; wrapper.dataset.wwFlow = '1';
      if (opts.layout === 'wide') wrapper.dataset.wwLayout = 'wide';
      const key = `${opts.docKey}#m${i}:${okind}`; wrapper.dataset.wwKey = key;
      const top = el('div', 'ww-top'); top.title = OTHER_LABEL[okind]; top.appendChild(makeSwitch('Mermaid'));
      const stage = el('div', okind === 'gantt' ? 'ww-flow-stage' : 'ww-flow-stage ww-seq-stage'); const raw = el('div', 'ww-raw');
      div.parentNode?.insertBefore(wrapper, div); raw.appendChild(div);
      wrapper.appendChild(top); wrapper.appendChild(stage); wrapper.appendChild(raw);
      if (seq) stage.appendChild(buildSequence(seq));
      flowGraphs.set(wrapper, { kind: okind, gantt: gantt || undefined });
      blockRefs.set(wrapper, { kind: 'mermaid', src });
      const view = initialView(wrapper, mermaidViewOf(src), key, def);
      applyFlowView(wrapper, view);
      if (view === 'island' && gantt) drawFlow(wrapper);
      if (gantt && typeof ResizeObserver !== 'undefined') { let last = 0; const ro = new ResizeObserver(() => { if (wrapper.dataset.wwCurrent !== 'island') return; const w = stage.clientWidth; if (Math.abs(w - last) < 8) return; last = w; drawFlow(wrapper); }); ro.observe(stage); cleanups.push(() => ro.disconnect()); }
      return;
    }
    if (!/^(?:flowchart|graph)\b/.test(headLine)) return;
    const syncGraph = parseFlowchart(src);
    const syncKind = syncGraph ? classifyFlow(syncGraph) : null;
    let wrapper: HTMLElement | null = syncGraph && syncKind ? mountFlow(div, i, syncGraph, syncKind) : null;
    if (!opts.parseFlow) return;
    // Mermaid 자체 파서 결과가 오면 동기 결과와 비교해 다를 때만 바꿔 그린다
    let alive = true; cleanups.push(() => { alive = false; });
    opts.parseFlow(src).then(g2 => {
      if (!alive || !g2 || !div.isConnected) return;
      const k2 = classifyFlow(g2); if (!k2) return;
      if (wrapper) {
        const info = flowGraphs.get(wrapper);
        if (!info || !info.graph || sameFlowGraph(info.graph, g2)) return;
        info.graph = g2; info.kind = k2; wrapper.dataset.wwKind = k2; wrapper.title = FLOW_KIND_LABEL[k2];
        if (wrapper.dataset.wwCurrent === 'island') drawFlow(wrapper);
      } else if (!div.closest('.ww-island')) {
        wrapper = mountFlow(div, i, g2, k2);
      }
    }).catch(() => { /* 파싱 실패 → 동기 결과 유지 */ });
  });

  /** flowchart 섬 하나를 DOM 에 세운다(스위치·무대·원본 보관, 원인·결과면 우선순위 표 흡수, 폭 변화 감시). */
  function mountFlow(div: HTMLElement, i: number, graph: FlowGraph, kind: FlowIslandKind): HTMLElement {
    const wrapper = el('div', 'ww-island ww-island-flow'); wrapper.dataset.wwKind = kind; wrapper.dataset.wwFlow = '1';
    if (opts.layout === 'wide') wrapper.dataset.wwLayout = 'wide';
    const key = `${opts.docKey}#m${i}:${graph.nodes.size}`; wrapper.dataset.wwKey = key;
    const useDrawio = !!opts.drawioView;
    const top = el('div', 'ww-top'); top.title = FLOW_KIND_LABEL[kind]; top.appendChild(makeSwitch('Mermaid', useDrawio ? 'draw.io' : '섬'));
    // v3.99.3: draw.io 뷰에는 편집 진입점이 있어야 한다(그림 클릭은 아무 일도 하지 않는다)
    const onEdit = useDrawio ? opts.drawioView?.onEdit : undefined;
    if (onEdit) {
      const edit = el('button', 'ww-edit', '✎ 편집') as HTMLButtonElement;
      edit.type = 'button';
      edit.title = 'draw.io 편집기로 엽니다 — 지금 보이는 그림을 그대로 불러옵니다(무대를 더블클릭해도 같습니다)';
      edit.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); onEdit(srcOf(div)); });
      top.appendChild(edit);
    }
    const stage = el('div', useDrawio ? 'ww-flow-stage ww-drawio-stage' : 'ww-flow-stage'); const raw = el('div', 'ww-raw');
    if (onEdit) stage.addEventListener('dblclick', (ev) => { ev.preventDefault(); onEdit(srcOf(div)); });
    div.parentNode?.insertBefore(wrapper, div);
    raw.appendChild(div);
    wrapper.appendChild(top); wrapper.appendChild(stage); wrapper.appendChild(raw);
    let extra: CauseExtra | undefined;
    if (kind === 'cause') {
      // 시안 2 §04: 원인·결과 트리 바로 뒤(같은 절 안)의 우선순위 표를 읽어 High/Medium 과 판단 근거를 합친다
      let sib: Element | null = wrapper.nextElementSibling; let heading: Element | null = null;
      for (let hop = 0; sib && hop < 5; hop++, sib = sib.nextElementSibling) {
        if (/^H[12]$|^HR$/.test(sib.tagName)) break;
        if (/^H[34]$/.test(sib.tagName)) { if (/우선순위|중요도|priority|리스크 등급/i.test(sib.textContent || '')) { heading = sib; continue; } break; }
        const tbl = sib.tagName === 'TABLE' ? (sib as HTMLTableElement) : sib.querySelector<HTMLTableElement>('table');
        if (!tbl || tbl.closest('.ww-island')) continue; // 이미 다른 섬이 된 표는 건너뛴다(판별 실패로 남은 표는 흡수 가능)
        const pt = parseTable(tbl); const prio = pt ? parsePriorityTable(pt) : null;
        if (!prio) continue;
        extra = { priority: prio };
        tbl.dataset.wwDone = '1';
        const holder = sib.tagName === 'TABLE' ? sib : tbl;
        if (heading) { heading.remove(); raw.appendChild(heading); }
        holder.remove(); raw.appendChild(holder); // 원본(Mermaid) 보기에서 소제목·표도 함께 보인다
        break;
      }
    }
    flowGraphs.set(wrapper, { graph, kind, extra, elk: opts.elk, src: srcOf(div), drawio: opts.drawioView });
    blockRefs.set(wrapper, { kind: 'mermaid', src: srcOf(div) });
    const view = initialView(wrapper, mermaidViewOf(srcOf(div)), key, def);
    applyFlowView(wrapper, view);
    if (view === 'island') drawFlow(wrapper);
    if (typeof ResizeObserver !== 'undefined') {
      let last = 0;
      const ro = new ResizeObserver(() => {
        if (wrapper.dataset.wwCurrent !== 'island') return;
        const k = flowGraphs.get(wrapper)?.kind; if (k === 'map') return; // 지도는 폭과 무관(가로 스크롤)
        const w = stage.clientWidth; if (Math.abs(w - last) < 8) return; last = w;
        drawFlow(wrapper);
      });
      ro.observe(stage); cleanups.push(() => ro.disconnect());
    }
    return wrapper;
  }

  // v3.99.2: 예전 localStorage 선택을 문서 표식으로 **한 번만** 옮기고 항목을 지운다.
  //   (문서가 바뀌면 다시 렌더되고, 그때는 표식이 있으므로 두 번 옮기지 않는다)
  if (migrations.length && opts.onViewChange) {
    for (const m of migrations) {
      const ref = blockRefs.get(m.wrapper);
      if (ref) opts.onViewChange(ref, m.view);
      writeView(m.key, null);
    }
  }

  // 테마가 바뀌면 흐름 섬을 다시 그린다
  if (typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(() => {
      invalidateIslandTokens();
      container.querySelectorAll<HTMLElement>('.ww-island-flow').forEach(w => { if (w.dataset.wwCurrent === 'island') drawFlow(w); });
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    cleanups.push(() => mo.disconnect());
  }
  return () => { for (const c of cleanups) c(); };
}

/**
 * v3.99.4: 저장 직후 **그 블록만 즉시** 다시 그린다(마크다운 재렌더를 기다리지 않는다).
 *  `slug` 를 주면 그 편집본에 연결된 블록만, 안 주면 draw.io 뷰인 블록 전부를 다시 그린다.
 *  돌려주는 값은 다시 그린 블록 수 — 0 이면 호출부가 다른 방법(마크다운 재렌더)을 쓸 수 있다.
 */
export function refreshDrawio(container: HTMLElement, slug?: string): number {
  let n = 0;
  container.querySelectorAll<HTMLElement>('.ww-island-flow').forEach((w) => {
    const info = flowGraphs.get(w);
    if (!info || !info.drawio || !info.graph) return;
    if (w.dataset.wwCurrent !== 'island') return;              // Mermaid 보기면 그릴 것이 없다
    if (slug && drawioSlugOf(info.src || '') !== slug) return;
    const stage = w.querySelector<HTMLElement>('.ww-flow-stage');
    if (!stage) return;
    void drawDrawio(w, stage);
    n++;
  });
  return n;
}

/** 복사용 클론 정리: 표 섬 → 원본 표, 흐름 섬 → 보이는 쪽만, 스위치 UI 제거.
 *  원본 컨테이너의 svg 순서와 맞추려고 호출 측은 `[hidden]` 안의 svg 를 미리 제외해야 한다. */
export function prepareCloneForCopy(clone: HTMLElement, original: HTMLElement): void {
  const origWrappers = Array.from(original.querySelectorAll<HTMLElement>('.ww-island'));
  const cloneWrappers = Array.from(clone.querySelectorAll<HTMLElement>('.ww-island'));
  cloneWrappers.forEach((cw, i) => {
    const ow = origWrappers[i];
    cw.querySelector('.ww-top')?.remove();
    if (cw.dataset.wwFlow) {
      cw.querySelectorAll<HTMLElement>('[hidden]').forEach(h => h.remove());
      return;
    }
    const raw = ow ? rawTables.get(ow) : undefined;
    if (raw) { const t = raw.cloneNode(true) as HTMLElement; cw.replaceWith(t); }
  });
  clone.querySelectorAll<HTMLElement>('table.ww-matrix').forEach(t => { t.classList.remove('ww-matrix'); t.querySelectorAll('.ww-best, .ww-num').forEach(c => { c.classList.remove('ww-best'); c.classList.remove('ww-num'); }); });
}

/** 원본 컨테이너에서 복사 대상 svg 목록 (숨긴 섬/다이어그램 제외) */
export function visibleSvgs(container: HTMLElement): SVGElement[] {
  return Array.from(container.querySelectorAll<SVGElement>('svg')).filter(s => !s.closest('[hidden]') && !s.closest('.ww-top'));
}
