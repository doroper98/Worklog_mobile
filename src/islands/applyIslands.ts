/**
 * applyIslands — 렌더된 마크다운 컨테이너(.md-content)의 표와 mermaid 블록을 "섬"으로 바꾼다.
 *
 * v3.87.0: 마크다운 섬 도입.
 *  - 원문 마크다운은 손대지 않는다(LLM 출력·저장 파일·위키·검색 그대로).
 *  - 블록마다 [섬 | 표] / [섬 | Mermaid] 스위치를 붙인다. 선택은 문서 키 + 블록 번호로
 *    localStorage 에 기억되고, 기본값은 전역 설정(getIslandsDefault)이다.
 *  - LLM 이 `<table class="raw">` 를 붙이면 항상 표, `class="ww-kv"` 류를 붙이면 그 섬으로 강제.
 *  - 원본 표는 DOM 에서 떼어 두고(WeakMap) 스위치로 되돌린다. 숨긴 채 두지 않는 이유는
 *    Ctrl+F 검색이 보이지 않는 원본까지 세지 않게 하기 위해서다.
 *  - mermaid 블록(.mermaid-diagram)은 기존 렌더 effect 가 그대로 그리도록 DOM 에 남기고,
 *    섬 보기일 때는 hidden 으로만 감춘다.
 *  - 복사(Outlook)용으로 prepareCloneForCopy 를 제공: 표 섬은 원본 표로 되돌리고,
 *    흐름 섬은 보이는 쪽(SVG 또는 Mermaid)만 남긴다.
 */
import { parseTable, classifyTable, buildTableIsland, TABLE_KIND_LABEL } from './tableIslands';
import type { TableIslandKind } from './tableIslands';
import { parseFlowchart } from './mermaidFlowParser';
import type { FlowGraph } from './mermaidFlowParser';
import { classifyFlow, renderFlowIsland, FLOW_KIND_LABEL } from './flowIslands';
import type { FlowIslandKind } from './flowIslands';
import { invalidateIslandTokens } from './islandTokens';

export type IslandView = 'island' | 'raw';

const DEFAULT_KEY = 'workwiki.islands.default';
const VIEW_KEY = 'workwiki.islands.view';
const VIEW_CAP = 600;

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
const flowGraphs = new WeakMap<HTMLElement, { graph: FlowGraph; kind: FlowIslandKind }>();

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;
}

function makeSwitch(rawLabel: string): HTMLElement {
  const sw = el('div', 'ww-sw'); sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', '표시 방식');
  const a = el('button', undefined, '섬') as HTMLButtonElement; a.dataset.wwView = 'island'; a.type = 'button';
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

function drawFlow(wrapper: HTMLElement): void {
  const info = flowGraphs.get(wrapper); const stage = wrapper.querySelector<HTMLElement>('.ww-flow-stage');
  if (!info || !stage) return;
  const width = Math.max(240, (stage.clientWidth || wrapper.clientWidth || 600) - 20);
  stage.innerHTML = renderFlowIsland(info.graph, info.kind, width);
}

export interface ApplyOptions {
  /** 문서 식별 키 (블록별 선택 기억용). 예: `${date}|${title}` */
  docKey: string;
  /** false 면 섬을 만들지 않고 이미 만든 것도 원본으로 되돌린다. */
  enabled?: boolean;
}

/** 컨테이너에 섬을 적용한다. 반환값은 정리 함수(옵저버 해제). 재호출은 멱등. */
export function applyIslands(container: HTMLElement, opts: ApplyOptions): () => void {
  const enabled = opts.enabled !== false;
  const def = getIslandsDefault();
  const views = readViews();
  const cleanups: Array<() => void> = [];
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
      const key = wrapper.dataset.wwKey; if (key) writeView(key, view === getIslandsDefault() ? null : view);
    });
  }

  // ── 표 ──
  const tables = Array.from(container.querySelectorAll<HTMLTableElement>('.md-content table'));
  tables.forEach((table, i) => {
    if (table.dataset.wwDone) return;
    table.dataset.wwDone = '1';
    if (!enabled) return;
    if (table.classList.contains('raw') || table.closest('.ww-island')) return;
    const p = parseTable(table); if (!p) return;
    const forced = Array.from(table.classList).find(c => c.startsWith('ww-'))?.slice(3) as TableIslandKind | undefined;
    const kind = forced && forced in TABLE_KIND_LABEL ? forced : classifyTable(p);
    if (!kind) return;
    const island = buildTableIsland(table, kind, p);
    if (!island) return; // matrix: 표 자체를 꾸몄음
    island.classList.add('ww-island-content');
    const wrapper = el('div', 'ww-island'); wrapper.dataset.wwKind = kind;
    const key = `${opts.docKey}#t${i}:${p.headers.join('|').slice(0, 60)}`; wrapper.dataset.wwKey = key;
    const top = el('div', 'ww-top'); top.appendChild(el('span', 'ww-tag', TABLE_KIND_LABEL[kind])); top.appendChild(makeSwitch('표'));
    const body = el('div', 'ww-body');
    wrapper.appendChild(top); wrapper.appendChild(body);
    table.parentNode?.insertBefore(wrapper, table);
    table.remove(); rawTables.set(wrapper, table); islandNodes.set(wrapper, island);
    applyTableView(wrapper, views[key] ?? def);
  });

  // ── mermaid ──
  const diagrams = Array.from(container.querySelectorAll<HTMLElement>('.mermaid-diagram'));
  diagrams.forEach((div, i) => {
    if (div.dataset.wwDone) return;
    div.dataset.wwDone = '1';
    if (!enabled) return;
    if (div.closest('.ww-island')) return;
    const src = decodeURIComponent(div.dataset.mermaidSrc || '');
    const graph = parseFlowchart(src); if (!graph) return;
    const kind = classifyFlow(graph); if (!kind) return;
    const wrapper = el('div', 'ww-island ww-island-flow'); wrapper.dataset.wwKind = kind; wrapper.dataset.wwFlow = '1';
    const key = `${opts.docKey}#m${i}:${graph.nodes.size}`; wrapper.dataset.wwKey = key;
    const top = el('div', 'ww-top'); top.appendChild(el('span', 'ww-tag', FLOW_KIND_LABEL[kind])); top.appendChild(makeSwitch('Mermaid'));
    const stage = el('div', 'ww-flow-stage'); const raw = el('div', 'ww-raw');
    div.parentNode?.insertBefore(wrapper, div);
    raw.appendChild(div);
    wrapper.appendChild(top); wrapper.appendChild(stage); wrapper.appendChild(raw);
    flowGraphs.set(wrapper, { graph, kind });
    const view = views[key] ?? def;
    applyFlowView(wrapper, view);
    if (view === 'island') drawFlow(wrapper);
    if (kind !== 'map' && typeof ResizeObserver !== 'undefined') {
      let last = 0;
      const ro = new ResizeObserver(() => {
        if (wrapper.dataset.wwCurrent !== 'island') return;
        const w = stage.clientWidth; if (Math.abs(w - last) < 8) return; last = w;
        drawFlow(wrapper);
      });
      ro.observe(stage); cleanups.push(() => ro.disconnect());
    }
  });

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
