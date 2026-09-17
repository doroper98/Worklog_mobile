/**
 * flowIslands — Mermaid flowchart 그래프를 "섬" SVG 로 그린다.
 *
 * v3.87.0: 마크다운 섬 도입. Mermaid 의 근본 문제(그림 한 장을 viewBox 로 폭에 맞춰 늘이고
 *  줄이니 글자가 함께 커지고 작아짐)를 피하기 위해, 글자 크기는 고정하고 배치가 폭에 적응한다.
 *
 *  - rail  : 순서 + 분기. 폭이 모자라면 줄을 바꿔 뱀처럼 이어 그린다(행이 바뀔 때 직각 고리).
 *  - cause : 뿌리 하나 → 원인 n개 → 결과 1개씩인 트리를 두 열(원인|결과)로.
 *  - map   : subgraph 를 레인/열로 두고 직각 라우팅 + 노드별 분리 진입 포트로 연계 지도를.
 *  판별이 안 되는 그래프는 null → Mermaid 렌더 그대로.
 *
 *  선 어휘(참고 시트): 실선 1.4 = 흐름 · 액센트 2.2 = 축 · 5,3 굵게 = 위험/우회 ·
 *  2,3 = 되돌림 · 1,3 = 참조. 색은 앱 --yk-* 토큰.
 */
import type { FlowGraph, FlowEdge, FlowSubgraph, FlowShape } from './mermaidFlowParser';
import { resolveIslandTokens, measureText, labelWidth, wrapText, wrapBalanced, svgEl, svgText } from './islandTokens';

/** 라벨을 줄로 펼친다.
 *  - 명시적 줄바꿈이 있고 첫 줄이 한글 없는 짧은 이름(c-DN, TOS, SimBD …)이면 "시스템 줄": 작은 흐린 글씨로 위에,
 *    다음 단락이 굵은 제목(시안 2 단계 궤도와 같은 모양).
 *  - 그 밖에는 첫 단락이 굵은 제목, 나머지 단락은 보통 굵기(E1 Stage 처럼 제목+설명).
 *  head = 굵게 그릴 줄 수(시스템 줄 포함 인덱스 기준), sys = 시스템 줄 유무 */
function layoutLabel(label: string, maxW: number, size: number, family: string): { lines: string[]; head: number; sys: boolean } {
  if (!label.includes('\n')) return { lines: wrapBalanced(label, maxW, size, 600, family), head: Number.MAX_SAFE_INTEGER, sys: false };
  const segs = label.split('\n');
  const sys = segs.length >= 2 && segs[0].length <= 12 && !/[\u3131-\uD79D]/.test(segs[0]);
  if (sys) {
    const titleLines = wrapBalanced(segs[1], maxW, size, 600, family);
    const rest = segs.slice(2).flatMap(sg => wrapBalanced(sg, maxW, size - 0.5, 400, family));
    return { lines: [segs[0], ...titleLines, ...rest], head: 1 + titleLines.length, sys: true };
  }
  const headLines = wrapBalanced(segs[0], maxW, size, 600, family);
  const rest = segs.slice(1).flatMap(sg => wrapBalanced(sg, maxW, size - 0.5, 400, family));
  return { lines: [...headLines, ...rest], head: headLines.length, sys: false };
}
function drawLines(x: number, top: number, lines: string[], head: number, size: number, baseWeight: number, anchor: 'middle' | 'start', t: IslandTokens, sys = false): string {
  let s = '';
  lines.forEach((ln, k) => {
    if (sys && k === 0) { s += svgText(x, top + 12 + k * 16, ln, { size: 10.5, weight: 500, fill: t.muted, anchor, family: t.mono }, t); return; }
    const isHead = k < head;
    s += svgText(x, top + 13 + k * 16, ln, { size: isHead ? size : size - 0.5, weight: isHead ? baseWeight : 400, fill: isHead ? t.text : t.text2, anchor }, t);
  });
  return s;
}
import type { IslandTokens } from './islandTokens';

export type FlowIslandKind = 'rail' | 'branch' | 'cause' | 'map' | 'graph';

type StrokeKind = 'flow' | 'soft' | 'axis' | 'strong' | 'no' | 'back' | 'ref';

interface StrokeSpec { stroke: string; width: number; dash?: string; opacity?: number; marker: string }

function strokeSpec(kind: StrokeKind, t: IslandTokens): StrokeSpec {
  switch (kind) {
    case 'axis': return { stroke: t.primary, width: 2.2, marker: 'primary' };
    case 'strong': return { stroke: t.text, width: 1.7, marker: 'text' };
    case 'soft': return { stroke: t.text, width: 1.2, opacity: 0.4, marker: 'muted' };
    case 'no': return { stroke: t.red, width: 2, dash: '5,3', marker: 'red' };
    case 'back': return { stroke: t.text2, width: 1.4, dash: '2,3', marker: 'text2' };
    case 'ref': return { stroke: t.muted, width: 1.2, dash: '1,3', marker: 'muted' };
    default: return { stroke: t.text, width: 1.4, marker: 'text' };
  }
}

function defs(t: IslandTokens, uid: string): string {
  const m = (id: string, color: string) => svgEl('marker', {
    id: `${uid}-ar-${id}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse',
  }, svgEl('path', { d: 'M1 1 L9 5 L1 9 z', fill: color }));
  return svgEl('defs', {}, m('text', t.text) + m('text2', t.text2) + m('muted', t.muted) + m('primary', t.primary) + m('red', t.red));
}

/** v3.98.0: `edge` 를 주면 `data-ww-edge="from>>to"` 가 붙는다 — 섬 SVG 를 draw.io XML 로 내보낼 때 쓰는 표시(그림은 그대로). */
function pathEl(d: string, kind: StrokeKind, t: IslandTokens, uid: string, opts?: { noArrow?: boolean; startArrow?: boolean; edge?: [string, string] }): string {
  const s = strokeSpec(kind, t);
  return svgEl('path', {
    d, fill: 'none', stroke: s.stroke, 'stroke-width': s.width, 'stroke-dasharray': s.dash, 'stroke-opacity': s.opacity, 'stroke-linecap': 'round',
    'data-ww-edge': opts?.edge ? `${opts.edge[0]}>>${opts.edge[1]}` : undefined,
    'data-ww-kind': opts?.edge ? kind : undefined,
    'marker-end': opts?.noArrow ? undefined : `url(#${uid}-ar-${s.marker})`,
    'marker-start': opts?.startArrow ? `url(#${uid}-ar-${s.marker})` : undefined,
  });
}

/** v3.92.3: 한 노드의 같은 면에 붙는 선이 여럿이면 base(0.25 위쪽 / 0.75 아래쪽) 근처에서 9px 간격으로 나눈다.
 *  노드 높이가 모자라면 안쪽(위아래 5px)으로 좁혀 균등 분할한다. 화살표가 한 점에 몰리는 것을 막는다. */
function portYs(n: number, y: number, h: number, base: number): number[] {
  if (n <= 0) return [];
  const lo = y + 5, hi = y + h - 5;
  let step = 9;
  if ((n - 1) * step > hi - lo) step = (hi - lo) / Math.max(1, n - 1);
  let start = y + h * base - (n - 1) * step / 2;
  start = Math.max(lo, Math.min(hi - (n - 1) * step, start));
  return Array.from({ length: n }, (_, j) => Math.round(start + j * step));
}

/** v3.95.1: 한 노드의 위/아래 면에 붙는 선이 여럿이면 base(0.8) 자리에서 왼쪽으로 12px 간격으로 나눈다.
 *  노드 폭이 모자라면 좌우 8px 안쪽으로 좁혀 균등 분할한다. */
function portXs(n: number, x: number, w: number, base: number): number[] {
  if (n <= 0) return [];
  const lo = x + 8, hi = x + w - 8;
  let step = 12;
  if ((n - 1) * step > hi - lo) step = (hi - lo) / Math.max(1, n - 1);
  let start = x + w * base;
  start = Math.min(hi, Math.max(lo + (n - 1) * step, start));
  return Array.from({ length: n }, (_, j) => Math.round(start - j * step));
}

/** v3.98.1: 한 노드에서 **나가는** 선이 여럿이면 출발점도 나눈다(들어오는 선은 WP8-1 에서 이미 나눴다).
 *  직사각형: 그 면의 (i+1)/(n+1) 위치.
 *  마름모: 꼭짓점에서 아래 꼭짓점으로 가는 변 위의 점 P(t) = V + t·(아래꼭짓점 − V), t = i/n.
 *    (i=0 이 꼭짓점. 변 위라 마름모 밖으로 나가지 않는다.) */
function exitPoint(
  box: { x: number; y: number; w: number; h: number; shape?: FlowShape },
  side: 'right' | 'left', i: number, n: number,
): { x: number; y: number } {
  const { x, y, w, h } = box;
  if (box.shape === 'decision') {
    const vx = side === 'right' ? x + w : x;
    const vy = y + h / 2;
    const t = n <= 1 ? 0 : i / n;                 // 0 이면 꼭짓점, 커질수록 아래 꼭짓점 쪽
    return { x: Math.round(vx + t * (x + w / 2 - vx)), y: Math.round(vy + t * (y + h - vy)) };
  }
  return { x: side === 'right' ? x + w : x, y: Math.round(y + h * (i + 1) / (n + 1)) };
}

/** 꺾이는 곳을 둥글게 한 직각 경로 */
function ortho(pts: Array<[number, number]>, r: number): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1], nx = pts[i + 1];
    if (!nx) { d += ` L${p[0]} ${p[1]}`; break; }
    const l1 = Math.hypot(p[0] - q[0], p[1] - q[1]), l2 = Math.hypot(nx[0] - p[0], nx[1] - p[1]);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 1) { d += ` L${p[0]} ${p[1]}`; continue; }
    const ax = p[0] - Math.sign(p[0] - q[0]) * rr, ay = p[1] - Math.sign(p[1] - q[1]) * rr;
    const bx = p[0] + Math.sign(nx[0] - p[0]) * rr, by = p[1] + Math.sign(nx[1] - p[1]) * rr;
    d += ` L${ax} ${ay} Q${p[0]} ${p[1]} ${bx} ${by}`;
  }
  return d;
}

let uidSeq = 0;
function nextUid(): string { uidSeq += 1; return `wwf${uidSeq}`; }

/** 노드 테두리(모양별). decision = 액센트 알약, cylinder = 위아래 타원(DB), circle = 이중 알약,
 *  stadium = 둥근 알약, subroutine = 양옆 이중선, hexagon = 모서리 깎음, 그 밖은 둥근 사각형. */
function nodeBox(x: number, y: number, w: number, h: number, shape: FlowShape | undefined, t: IslandTokens, nodeId?: string): string {
  const inner = nodeBoxShape(x, y, w, h, shape, t);
  // v3.98.0: 내보내기용 표시. 그림에는 영향이 없다(<g> 는 그리기 속성을 바꾸지 않는다).
  return nodeId === undefined ? inner
    : svgEl('g', { 'data-ww-node': nodeId, 'data-ww-box': `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}`, 'data-ww-shape': shape || 'box' }, inner);
}
function nodeBoxShape(x: number, y: number, w: number, h: number, shape: FlowShape | undefined, t: IslandTokens): string {
  const base = { fill: t.surface, stroke: t.borderStrong, 'stroke-width': 1 };
  switch (shape) {
    case 'decision': return svgEl('path', { d: `M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z`, 'stroke-linejoin': 'round', fill: t.surface, stroke: t.primary, 'stroke-width': 1.5 });
    case 'cylinder': { const ry = 5, rx = w / 2, side = h - 2 * ry; return svgEl('path', { d: `M${x} ${y + ry} a${rx} ${ry} 0 0 0 ${w} 0 a${rx} ${ry} 0 0 0 ${-w} 0 v${side} a${rx} ${ry} 0 0 0 ${w} 0 v${-side}`, ...base }); }
    case 'circle': return svgEl('rect', { x, y, width: w, height: h, rx: h / 2, ...base }) + svgEl('rect', { x: x + 3, y: y + 3, width: w - 6, height: h - 6, rx: (h - 6) / 2, fill: 'none', stroke: t.borderStrong, 'stroke-width': 1 });
    case 'stadium': return svgEl('rect', { x, y, width: w, height: h, rx: Math.min(14, h / 2), ...base });
    case 'subroutine': return svgEl('rect', { x, y, width: w, height: h, rx: 3, ...base }) + svgEl('path', { d: `M${x + 5} ${y} v${h} M${x + w - 5} ${y} v${h}`, fill: 'none', stroke: t.borderStrong, 'stroke-width': 1 });
    case 'hexagon': { const c = Math.min(10, h / 2); return svgEl('path', { d: `M${x + c} ${y} H${x + w - c} L${x + w} ${y + h / 2} L${x + w - c} ${y + h} H${x + c} L${x} ${y + h / 2} Z`, ...base }); }
    default: return svgEl('rect', { x, y, width: w, height: h, rx: 6, ...base });
  }
}

/** 결정 노드(마름모) 크기. 글 덩어리 tw×th 가 마름모 안에 들어가려면 tw/(2a) + th/(2b) ≤ 1 (a,b = 가로·세로 반대각).
 *  글은 maxW 의 55% 안으로 접어 마름모가 지나치게 넓어지지 않게 하고, 그래도 maxW 를 넘으면 폭을 고정하고 높이를 키운다. */
function decisionLayout(label: string, maxW: number, size: number, family: string): { lines: string[]; head: number; sys: boolean; w: number; h: number } {
  const ll = layoutLabel(label, Math.max(60, maxW * 0.55), size, family);
  const tw = Math.max(...ll.lines.map(l => measureText(l, size, 600, family))), th = ll.lines.length * 16;
  let b = th / 2 + 16;
  let a = (tw / 2) / (1 - th / (2 * b)) + 6;
  if (2 * a > maxW) { a = maxW / 2; b = th / (2 * (1 - tw / (2 * a))) + 4; }
  return { lines: ll.lines, head: ll.head, sys: ll.sys, w: Math.ceil(2 * a), h: Math.ceil(2 * b) };
}
/** 노드 라벨 배치: 결정이면 마름모 크기, 아니면 상자(폭 boxW, 높이 18 + 줄수×16) */
function nodeLayout(label: string, shape: FlowShape | undefined, boxW: number, pad: number, size: number, family: string): { lines: string[]; head: number; sys: boolean; w: number; h: number } {
  if (shape === 'decision') return decisionLayout(label, boxW, size, family);
  const ll = layoutLabel(label, boxW - 2 * pad, size, family);
  return { lines: ll.lines, head: ll.head, sys: ll.sys, w: boxW, h: 18 + ll.lines.length * 16 };
}

/** 가지 궤도의 잎·입력 항목: 태그 칩 + 라벨(남은 폭에 맞춰 줄바꿈). h = 차지하는 높이, maxX = 오른쪽 끝 */
interface ItemLay { tag: string; col: string; lines: string[]; x: number; tagW: number }
function layoutItems(st: TrunkStep, bx: number, W: number, t: IslandTokens): { items: ItemLay[]; h: number; maxX: number } {
  const src = [...st.joins.map(j => ({ tag: j.tag, label: `${j.label} →`, col: t.blue })), ...st.leaves.map(l => ({ tag: l.tag, label: l.label, col: t.text2 }))];
  const items: ItemLay[] = []; let h = 0, maxX = 0;
  for (const it of src) {
    const tagW = it.tag ? measureText(it.tag, 10.5, 600, t.font) + 12 : 0;
    const x = bx + 14 + (tagW ? tagW + 8 : 0);
    const lines = wrapText(it.label.replace(/\n/g, ' '), Math.max(80, W - x - 8), 12, 400, t.font);
    items.push({ tag: it.tag, col: it.col, lines, x, tagW });
    h += Math.max(20, lines.length * 16 + 4);
    maxX = Math.max(maxX, x + Math.max(0, ...lines.map(l => measureText(l, 12, 400, t.font))) + 8);
  }
  return { items, h: h ? h + 8 : 0, maxX };
}
function drawItems(svg: string, lay: { items: ItemLay[] }, p: { x: number; y: number; h: number }, yy: number, t: IslandTokens, parentId?: string): string {
  const bx = p.x + 18;
  let itemIndex = 0;
  for (const it of lay.items) {
    const itemTop = yy - 12, itemLeft = Math.round(it.x);
    svg += svgEl('path', { d: `M${bx} ${p.y + p.h} V${yy} H${bx + 12}`, fill: 'none', stroke: t.border, 'stroke-width': 1.2 });
    if (it.tag) { svg += svgEl('rect', { x: bx + 14, y: yy - 9, width: it.tagW, height: 18, rx: 4, fill: t.surface, stroke: it.col, 'stroke-width': 1 }); svg += svgText(bx + 20, yy + 4, it.tag, { size: 10.5, weight: 600, fill: it.col }, t); }
    // v3.92.3: 본선 세로선이 항목 글자를 관통해 보이지 않도록 배경색 halo 를 준다(선이 글자 뒤에서 끊긴 것처럼 보인다)
    it.lines.forEach((ln, k) => { svg += svgText(it.x, yy + 4 + k * 16, ln, { size: 12, fill: t.text2, halo: t.surface }, t); });
    if (parentId !== undefined) {
      // v3.98.0: 내보내기용 표시(보이지 않는 사각형). 항목 글자 덩어리의 자리를 기록한다.
      const iw = Math.max(40, Math.round(Math.max(...it.lines.map(l => measureText(l, 12, 400, t.font))) + 8));
      svg += svgEl('rect', { x: itemLeft, y: Math.round(itemTop), width: iw, height: Math.max(18, it.lines.length * 16), fill: 'none', stroke: 'none',
        'data-ww-item': `${parentId}|${itemIndex}`, 'data-ww-text': (it.tag ? it.tag + ' · ' : '') + it.lines.join(' ') });
    }
    itemIndex += 1;
    yy += Math.max(20, it.lines.length * 16 + 4);
  }
  return svg;
}

// ────────────────────────────────────────────────────────────────────────────
// 판별
// ────────────────────────────────────────────────────────────────────────────

interface Degree { indeg: Map<string, number>; outdeg: Map<string, number>; out: Map<string, FlowEdge[]>; inn: Map<string, FlowEdge[]> }

function degrees(g: FlowGraph, includeDashed: boolean): Degree {
  const indeg = new Map<string, number>(), outdeg = new Map<string, number>();
  const out = new Map<string, FlowEdge[]>(), inn = new Map<string, FlowEdge[]>();
  for (const id of g.nodes.keys()) { indeg.set(id, 0); outdeg.set(id, 0); out.set(id, []); inn.set(id, []); }
  for (const e of g.edges) {
    if (!includeDashed && e.dashed) continue;
    if (!g.nodes.has(e.from) || !g.nodes.has(e.to)) continue;
    outdeg.set(e.from, (outdeg.get(e.from) || 0) + 1);
    indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    out.get(e.from)!.push(e);
    inn.get(e.to)!.push(e);
  }
  return { indeg, outdeg, out, inn };
}

/** 실선 기준 가장 긴 단순 경로 (노드 12개 이하에서만 호출) */
function longestPath(g: FlowGraph, d: Degree): string[] {
  let best: string[] = []; let bestScore = -1;
  // 같은 길이면 본선이 설명하는 선(양 끝이 본선 위)이 많은 쪽: 되돌림·건너뜀이 옆 통로로 그려지고 본선 밖 노드가 줄어든다
  const score = (path: string[]) => { const on = new Set(path); let k = 0; for (const e of g.edges) if (on.has(e.from) && on.has(e.to)) k++; return k; };
  const visit = (id: string, path: string[], seen: Set<string>) => {
    if (path.length >= best.length) { const sc = score(path); if (path.length > best.length || sc > bestScore) { best = path.slice(); bestScore = sc; } }
    for (const e of d.out.get(id) || []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to); path.push(e.to);
      visit(e.to, path, seen);
      path.pop(); seen.delete(e.to);
    }
  };
  const sources = Array.from(g.nodes.keys()).filter(id => (d.indeg.get(id) || 0) === 0);
  for (const s of (sources.length ? sources : Array.from(g.nodes.keys()))) visit(s, [s], new Set([s]));
  return best;
}

function classifyCore(g: FlowGraph): FlowIslandKind | null {
  const n = g.nodes.size;
  if (n < 2) return null;
  const inSg = Array.from(g.nodes.values()).filter(x => x.subgraph).length;
  if (g.subgraphs.length >= 2 && inSg >= n * 0.8) return 'map';
  if (g.subgraphs.length > 0) return null;
  const d = degrees(g, true);
  // cause: 뿌리 1 → 자식(원인) ≥3 → 각 자식은 손자(결과) ≤1
  const roots = Array.from(g.nodes.keys()).filter(id => (d.indeg.get(id) || 0) === 0);
  if (roots.length === 1 && (d.outdeg.get(roots[0]) || 0) >= 3) {
    const root = roots[0];
    const kids = (d.out.get(root) || []).map(e => e.to);
    let ok = true;
    const covered = new Set<string>([root, ...kids]);
    for (const k of kids) {
      if ((d.indeg.get(k) || 0) !== 1 || (d.outdeg.get(k) || 0) > 1) { ok = false; break; }
      for (const e of d.out.get(k) || []) {
        if ((d.outdeg.get(e.to) || 0) !== 0 || (d.indeg.get(e.to) || 0) !== 1) { ok = false; break; }
        covered.add(e.to);
      }
      if (!ok) break;
    }
    if (ok && covered.size === n) return 'cause';
  }
  // rail: 실선 기준 긴 경로 위에 대부분의 노드가 있고, 나머지는 경로 노드의 자식(분기)
  if (n > 24) return null;
  const ds = degrees(g, false);
  const path = longestPath(g, d); // 점선 사슬(G -.-> H -.-> I)도 본선이 될 수 있다
  if (path.length < Math.max(3, Math.ceil(n * 0.5))) return null;
  const onPath = new Set(path);
  let plainRail = n <= 14 && path.length >= Math.ceil(n * 0.6) && n - path.length <= 4;
  let hasChain = false;
  for (const id of g.nodes.keys()) {
    if (onPath.has(id)) continue;
    const parents = (ds.inn.get(id) || []).filter(e => onPath.has(e.from));
    const isLeaf = parents.length > 0 && (ds.outdeg.get(id) || 0) === 0;
    // 합류 입력: 바깥 노드가 경로 노드 하나로만 들어간다 (예: MDS·MDM 분류 → 통합 분류)
    const outs = ds.out.get(id) || [];
    const isJoin = (ds.indeg.get(id) || 0) === 0 && outs.length === 1 && onPath.has(outs[0].to);
    if (isLeaf || isJoin) continue;
    // 가지: 부모 하나(경로 또는 앞 가지 노드), 자식 0~1개. 가지 끝은 잎이거나 경로로 합류.
    if ((ds.indeg.get(id) || 0) !== 1 || outs.length > 1) return null;
    plainRail = false; hasChain = true;
  }
  // 경로 안에서 뒤로 가는 실선(되돌림)이나 결정 마름모가 있으면 분기 궤도가 맞다
  const hasDecision = Array.from(g.nodes.values()).some(x => x.shape === 'decision');
  const hasLoop = g.edges.some(e => onPath.has(e.from) && onPath.has(e.to) && path.indexOf(e.to) < path.indexOf(e.from));
  if (plainRail && !hasChain && !hasDecision && !hasLoop) return 'rail';
  return 'branch';
}

/** 판별. 어떤 모양에도 안 맞으면 관계 그래프(층별 배치)로라도 그린다. 2~80 노드. */
export function classifyFlow(g: FlowGraph): FlowIslandKind | null {
  const core = classifyCore(g);
  if (core) return core;
  const n = g.nodes.size;
  if (n >= 2 && n <= 80 && g.edges.length > 0) return 'graph';
  return null;
}

/** 층(rank): 출발 노드에서의 최장 거리. 되돌림(뒤로 가는 엣지)은 무시한다. */
function buildRanks(g: FlowGraph): FlowSubgraph[] {
  const ids = Array.from(g.nodes.keys());
  const rank = new Map<string, number>(); ids.forEach(id => rank.set(id, 0));
  const edges = g.edges.filter(e => g.nodes.has(e.from) && g.nodes.has(e.to) && e.from !== e.to);
  for (let it = 0; it < ids.length + 1; it++) {
    let changed = false;
    for (const e of edges) { const r = rank.get(e.from)! + 1; if (r > rank.get(e.to)! && r <= ids.length) { rank.set(e.to, r); changed = true; } }
    if (!changed) break;
  }
  const maxR = Math.max(...rank.values());
  const lanes: FlowSubgraph[] = [];
  for (let r = 0; r <= maxR; r++) { const nodes = ids.filter(id => rank.get(id) === r).sort((a, b) => g.nodes.get(a)!.order - g.nodes.get(b)!.order); if (nodes.length) lanes.push({ id: `rank${r}`, title: '', nodes }); }
  return lanes;
}

// ────────────────────────────────────────────────────────────────────────────
// rail
// ────────────────────────────────────────────────────────────────────────────

interface BranchItem { tag: string; label: string; kind: 'ok' | 'no' | 'alt' | 'in'; back?: string }
interface RailStep { id: string; label: string; shape?: FlowShape; branch?: BranchItem[] }

function buildRail(g: FlowGraph): RailStep[] {
  const ds = degrees(g, false);
  const dAll = degrees(g, true);
  const path = longestPath(g, dAll);
  const onPath = new Set(path);
  const steps: RailStep[] = [];
  const skip = new Set<string>();
  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    if (skip.has(id)) continue;
    const node = g.nodes.get(id)!;
    const outs = (ds.out.get(id) || []);
    const labeled = outs.filter(e => e.label);
    const offPath = outs.filter(e => !onPath.has(e.to));
    const step: RailStep = { id, label: node.label, shape: node.shape };
    // 합류 입력: 경로 밖에서 이 노드로 들어오는 노드들
    const joins = (ds.inn.get(id) || []).filter(e => !onPath.has(e.from));
    if (joins.length > 0) step.branch = joins.map(e => ({ tag: e.label || '입력', label: g.nodes.get(e.from)!.label, kind: 'in' as const }));
    if (offPath.length > 0 || labeled.length >= 2) {
      const items: BranchItem[] = [];
      for (const e of outs) {
        const target = g.nodes.get(e.to)!;
        const isNext = path[i + 1] === e.to;
        if (isNext && labeled.length < 2) continue; // 라벨 없는 본선은 분기가 아님
        const backEdge = (dAll.out.get(e.to) || []).find(b => onPath.has(b.to) && path.indexOf(b.to) <= i);
        const item: BranchItem = { tag: e.label || '', label: target.label, kind: backEdge ? 'no' : isNext ? 'ok' : 'alt' };
        if (backEdge) item.back = backEdge.label || '되돌림';
        items.push(item);
        if (isNext) skip.add(e.to); // 본선 다음 노드가 분기 항목으로 들어갔으면 궤도에서는 건너뜀
      }
      if (items.length) step.branch = [...(step.branch || []), ...items];
    }
    steps.push(step);
  }
  return steps;
}

function drawRail(steps: RailStep[], width: number, t: IslandTokens): string {
  const uid = nextUid();
  const SZ = 12.5, pad = 14, W = Math.max(280, width);
  const hasBack = steps.some(s => s.branch?.some(b => b.back));
  let labelW = 0;
  for (const s of steps) labelW = Math.max(labelW, labelWidth(s.label, SZ, 600, t.font));
  const nodeW = Math.min(240, Math.max(124, Math.ceil(labelW) + 2 * pad));
  const laid = steps.map(s => layoutLabel(s.label, nodeW - 2 * pad, SZ, t.font));
  const lines = laid.map(l => l.lines);
  const maxL = Math.max(...lines.map(l => l.length));
  const nodeH = 18 + maxL * 16;
  const gapX = 44, gapY = hasBack ? 58 : 44, mL = hasBack ? 36 : 12, mT = hasBack ? 34 : 14, mR = hasBack ? 36 : 24;
  const cols = Math.max(1, Math.floor((W - mL - mR + gapX) / (nodeW + gapX)));
  const n = steps.length, rows = Math.ceil(n / cols);
  // 열 x 는 세로 위치와 무관하므로 먼저 구한다(분기 항목 줄바꿈 폭 계산에 필요)
  const colX = (i: number) => { const r = Math.floor(i / cols); let c = i % cols; if (r % 2 === 1) c = cols - 1 - c; return mL + c * (nodeW + gapX); };
  const usedW = Math.min(n, cols) * (nodeW + gapX) - gapX + mL + mR;
  const limitW = Math.max(usedW, W);
  // 분기 항목: 태그 칩 + 라벨. v3.92.3: 줄바꿈 폭을 '옆 열까지'와 '도표 오른쪽 끝까지' 중 좁은 쪽으로
  //   (마지막 열은 옆 열이 없어 gapX 만큼 넘쳐 340px 같은 좁은 폭에서 글자가 도표 밖으로 나갔다)
  type BL = { tag: string; tagW: number; lines: string[]; kind: BranchItem['kind']; back?: string; h: number };
  const blines: BL[][] = steps.map((s, i) => (s.branch || []).map(b => {
    const tagW = b.tag ? measureText(b.tag, 10.5, 600, t.font) + 12 : 0;
    const xoff = 18 + 14 + (tagW ? tagW + 8 : 0);
    const toEdge = limitW - mR - (colX(i) + xoff);
    const avail = cols > 1 ? Math.min(nodeW + gapX - 8 - xoff, toEdge) : toEdge;
    const lines = wrapText((b.kind === 'in' ? `${b.label} →` : b.label).replace(/\n/g, ' '), Math.max(70, avail), 12, 400, t.font);
    return { tag: b.tag, tagW, lines, kind: b.kind, back: b.back, h: Math.max(22, lines.length * 16 + 6) };
  }));
  const extra: number[] = [];
  steps.forEach((_s, i) => { const r = Math.floor(i / cols); const h = blines[i].length ? 14 + blines[i].reduce((a, b) => a + b.h, 0) : 0; extra[r] = Math.max(extra[r] || 0, h); });
  const y0: number[] = []; let yc = mT;
  for (let r = 0; r < rows; r++) { y0[r] = yc; yc += nodeH + extra[r] + (r < rows - 1 ? gapY : 0); }
  const H = yc + 10;
  const pos = steps.map((_s, i) => ({ x: colX(i), y: y0[Math.floor(i / cols)], r: Math.floor(i / cols) }));
  // v3.92.3: 글자가 실제로 차지한 오른쪽 끝(태그가 아주 길어 줄바꿈 하한 70px 에 걸리는 경우)까지 도표 폭을 넓혀 밖으로 나가지 않게 한다
  let maxX = usedW;
  let s = '';
  for (let i = 0; i < n - 1; i++) {
    const a = pos[i], b = pos[i + 1], am = a.y + nodeH / 2, bm = b.y + nodeH / 2;
    if (a.r === b.r) {
      const dir = b.x > a.x ? 1 : -1;
      const x1 = dir > 0 ? a.x + nodeW : a.x, x2 = dir > 0 ? b.x : b.x + nodeW;
      s += pathEl(`M${x1 + dir} ${am} L${x2 - dir * 3} ${am}`, 'flow', t, uid, { edge: [steps[i].id, steps[i + 1].id] });
    } else {
      if (cols === 1 && !steps[i].branch) { const xm = a.x + nodeW / 2; s += pathEl(`M${xm} ${a.y + nodeH + 1} L${xm} ${b.y - 3}`, 'flow', t, uid, { edge: [steps[i].id, steps[i + 1].id] }); continue; }
      const right = cols === 1 || a.r % 2 === 0;
      const ex = right ? a.x + nodeW : a.x, hx = right ? ex + 18 : ex - 18, tx = right ? b.x + nodeW + 3 : b.x - 3;
      s += pathEl(`M${ex + (right ? 1 : -1)} ${am} H${hx} V${bm} H${tx}`, 'flow', t, uid, { edge: [steps[i].id, steps[i + 1].id] });
    }
  }
  steps.forEach((st, i) => {
    const p = pos[i];
    s += nodeBox(p.x, p.y, nodeW, nodeH, st.shape, t, st.id);
    const blockH = lines[i].length * 16, top = p.y + (nodeH - blockH) / 2;
    s += drawLines(p.x + nodeW / 2, top, lines[i], laid[i].head, SZ, 600, 'middle', t, laid[i].sys);
    if (blines[i].length) {
      const bx = p.x + 18, by = p.y + nodeH; let yy = by + 18;
      let bi = 0;
      for (const b of blines[i]) {
        s += svgEl('path', { d: `M${bx} ${by} V${yy} H${bx + 12}`, fill: 'none', stroke: t.border, 'stroke-width': 1.2 });
        const col = b.kind === 'no' ? t.red : b.kind === 'ok' ? t.green : b.kind === 'in' ? t.blue : t.text2;
        let x = bx + 14;
        if (b.tag) {
          s += svgEl('rect', { x, y: yy - 9, width: b.tagW, height: 18, rx: 4, fill: t.surface, stroke: col, 'stroke-width': 1 });
          s += svgText(x + 6, yy + 4, b.tag, { size: 10.5, weight: 600, fill: col }, t);
          x += b.tagW + 8;
        }
        b.lines.forEach((ln, k) => { s += svgText(x, yy + 4 + k * 16, ln, { size: 12, fill: t.text2, halo: t.surface }, t); maxX = Math.max(maxX, x + measureText(ln, 12, 400, t.font) + 8); });
        // v3.98.0: 내보내기용 표시(보이지 않는 사각형)
        s += svgEl('rect', { x: Math.round(x), y: Math.round(yy - 12), width: Math.max(40, Math.round(Math.max(...b.lines.map(l => measureText(l, 12, 400, t.font))) + 8)), height: Math.max(18, b.lines.length * 16), fill: 'none', stroke: 'none',
          'data-ww-item': `${st.id}|${bi}`, 'data-ww-text': (b.tag ? b.tag + ' · ' : '') + b.lines.join(' ') });
        if (b.back) {
          const lx = p.x - 16, topY = p.y - 14, inX = p.x + Math.round(nodeW * 0.4);
          s += pathEl(`M${bx + 14} ${yy} H${lx} V${topY} H${inX} V${p.y - 3}`, 'back', t, uid);   // 되돌림 라벨 줄(항목) — 그래프 엣지가 아니라 표시하지 않는다
          s += svgText(lx + 6, topY - 5, b.back, { size: 10, fill: t.text2 }, t);
        }
        bi += 1;
        yy += b.h;
      }
    }
  });
  const SW = Math.max(usedW, W, Math.ceil(maxX));
  return svgEl('svg', { width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + s);
}

// ────────────────────────────────────────────────────────────────────────────
// branch (세로 본선 + 오른쪽 가지 + 합류/되돌림)
// ────────────────────────────────────────────────────────────────────────────

interface Chain { tag: string; nodes: string[]; rejoin: number | null; dashed: boolean }
interface TrunkStep { id: string; tags: string[]; dashed: boolean; chains: Chain[]; loops: Array<{ to: number; label: string }>; skips: Array<{ to: number; label: string; dashed: boolean }>; joins: Array<{ label: string; tag: string }>; leaves: BranchItem[] }
/** 본선 옆(왼쪽 통로)으로 그리는 선: 되돌림(loop) 과 라벨 있는 건너뜀(skip) */
type SideEdge = { to: number; label: string; kind: StrokeKind }
function sideEdges(st: TrunkStep): SideEdge[] { return [...st.loops.map(l => ({ to: l.to, label: l.label, kind: 'back' as StrokeKind })), ...st.skips.map(k => ({ to: k.to, label: k.label, kind: (k.dashed ? 'ref' : 'flow') as StrokeKind }))]; }

function buildBranch(g: FlowGraph): TrunkStep[] {
  const dAll = degrees(g, true);
  const path = longestPath(g, dAll);
  const idx = new Map<string, number>(); path.forEach((id, i) => idx.set(id, i));
  const used = new Set<string>(path);
  const steps: TrunkStep[] = path.map(id => ({ id, tags: [], dashed: false, chains: [], loops: [], skips: [], joins: [], leaves: [] }));
  path.forEach((id, i) => {
    const st = steps[i];
    for (const e of dAll.out.get(id) || []) {
      const ti = idx.get(e.to);
      if (ti !== undefined) {
        if (ti === i + 1) { if (e.label) st.tags.push(e.label); if (e.dashed) st.dashed = true; continue; }
        if (ti <= i) { st.loops.push({ to: ti, label: e.label || '' }); continue; }
        // 앞으로 건너뛰는 경로 내 엣지: 라벨이나 점선이면 뜻이 있으니 옆 통로로 그리고, 맨 화살표면 본선이 대신한다
        if (e.label || e.dashed) st.skips.push({ to: ti, label: e.label || '', dashed: e.dashed });
        continue;
      }
      // 가지 따라가기
      const nodes: string[] = []; let cur = e.to; let rejoin: number | null = null; let guard = 0;
      while (cur && !idx.has(cur) && guard++ < 32) {
        if (used.has(cur)) break;
        nodes.push(cur); used.add(cur);
        const nx = (dAll.out.get(cur) || [])[0];
        if (!nx) break;
        if (idx.has(nx.to)) { rejoin = idx.get(nx.to)!; break; }
        cur = nx.to;
      }
      if (nodes.length === 0) continue;
      const single = nodes.length === 1 && rejoin === null && (dAll.outdeg.get(nodes[0]) || 0) === 0;
      if (single && !e.dashed && !g.nodes.get(nodes[0])!.shape && g.nodes.get(id)!.shape !== 'decision') {
        st.leaves.push({ tag: e.label || '', label: g.nodes.get(nodes[0])!.label, kind: 'alt' });
      } else st.chains.push({ tag: e.label || '', nodes, rejoin, dashed: e.dashed });
    }
    for (const e of dAll.inn.get(id) || []) {
      if (idx.has(e.from) || used.has(e.from)) continue;
      if ((dAll.indeg.get(e.from) || 0) === 0 && (dAll.outdeg.get(e.from) || 0) === 1) { st.joins.push({ label: g.nodes.get(e.from)!.label, tag: e.label || '입력' }); used.add(e.from); }
    }
  });
  return steps;
}


/** 옆 통로(되돌림·건너뜀) 라벨 자리 배정: 통로가 지나는 빈 칸(from~to 사이) 중 비어 있는 칸부터 쓰고, 칸마다 줄 수를 센다.
 *  배치 단계에서 그 칸의 높이를 줄 수만큼 늘려 라벨이 노드·본선 태그와 겹치지 않게 한다. */
function assignSideLabels(steps: TrunkStep[], maxW: number, family: string): { at: Map<string, { k: number; row: number; lines: string[] }>; rows: number[] } {
  const at = new Map<string, { k: number; row: number; lines: string[] }>(); const rows: number[] = steps.map(() => 0);
  steps.forEach((st, i) => sideEdges(st).forEach((se, j) => {
    if (!se.label) return;
    const lines = wrapText(se.label.replace(/\n/g, ' '), maxW, 10, 400, family);
    const lo = Math.min(i, se.to), hi = Math.max(i, se.to);
    let k = lo; while (k < hi - 1 && rows[k] > 0) k++;
    at.set(`${i}:${j}`, { k, row: rows[k], lines }); rows[k] += lines.length;
  }));
  return { at, rows };
}

/** 좁은 폭(폰) 분기 궤도: 가지를 오른쪽이 아니라 본선 아래에 들여쓴 세로 목록으로 놓는다.
 *  가로 스크롤 없이 한 열로 읽히고, 본선 연결선은 왼쪽 가장자리로 우회해 가지를 가로지르지 않는다. */
function drawBranchNarrow(g: FlowGraph, width: number, t: IslandTokens): string {
  const uid = nextUid();
  const steps = buildBranch(g);
  const SZ = 12.5, pad = 12, W = Math.max(280, width);
  const sideN = steps.reduce((a, st) => a + st.loops.length + st.skips.length, 0); const hasLoop = sideN > 0;
  const hasRejoin = steps.some(st => st.chains.some(c => c.rejoin !== null));
  // v3.92.3: 통로를 여럿으로 나누므로(6px 씩 바깥) 오른쪽 여백을 그만큼 넓힌다
  const farRejoinN = steps.reduce((a, st, si) => a + st.chains.filter(c => c.rejoin !== null && c.rejoin !== si + 1).length, 0);
  const mL = hasLoop ? 28 + 10 * sideN : 10, mR = hasRejoin ? 26 + 6 * Math.max(0, farRejoinN - 1) : 10, mT = 12, gapY = 26, indent = 26, chainGap = 10;
  const labelOf = (id: string) => g.nodes.get(id)!.label;
  const nodeW = W - mL - mR;
  const chainW = nodeW - indent;
  type Placed = { id: string; x: number; y: number; w: number; h: number; lines: string[]; head: number; sys: boolean; shape?: FlowShape };
  const trunk: Placed[] = []; const extras: Placed[] = []; let svg = ''; let y = mT;
  const chainCols: Array<{ step: number; chain: Chain; placed: Placed[]; chainIndex: number }> = [];
  // v3.92.3: 같은 본선 노드로 합류가 둘 이상이면 오른쪽 면 위(0.25)/아래(0.75) 포트로 나눠 붙인다
  const nRejoinPortY = new Map<number, number>(); const nRejoinLane = new Map<number, number>();
  const itemY: number[] = []; const tagLineCache: string[][] = []; const itemLays: ReturnType<typeof layoutItems>[] = [];
  const sideLab = assignSideLabels(steps, Math.max(60, nodeW / 2), t.font);
  steps.forEach((st, si) => {
    const shape = g.nodes.get(st.id)!.shape;
    const ll = nodeLayout(labelOf(st.id), shape, nodeW, pad, SZ, t.font); const lines = ll.lines; const h = ll.h;
    const p: Placed = { id: st.id, x: mL + (nodeW - ll.w) / 2, y, w: ll.w, h, lines, head: ll.head, sys: ll.sys, shape };
    trunk.push(p);
    y += h;
    // 잎·입력 항목은 노드 바로 아래 (남은 폭에 맞춰 줄바꿈)
    const lay = layoutItems(st, p.x + 18, W - mR, t); itemLays.push(lay);
    itemY.push(y + 16);
    y += lay.h;
    // 가지: 들여쓴 세로 목록 (태그 줄 + 노드들)
    st.chains.forEach((ch, ck) => {
      const chTagLines = ch.tag ? wrapText(ch.tag, Math.max(80, W - mR - (mL + indent + 48)), 10.5, 600, t.font) : [];
      y += 22 + chTagLines.length * 16;
      const placed: Placed[] = [];
      for (const id of ch.nodes) {
        const shp = g.nodes.get(id)!.shape; const cl = nodeLayout(labelOf(id), shp, chainW, pad, SZ, t.font); const ls = cl.lines; const hh = cl.h;
        placed.push({ id, x: mL + indent + (chainW - cl.w) / 2, y, w: cl.w, h: hh, lines: ls, head: cl.head, sys: cl.sys, shape: shp });
        y += hh + chainGap + 14;
      }
      y -= chainGap + 14;
      chainCols.push({ step: trunk.length - 1, chain: ch, placed, chainIndex: ck });
      extras.push(...placed);
    });
    const tagX = st.chains.length ? mL + 18 : mL + nodeW / 2 + 8;
    const tagLines = st.tags.flatMap(tag => wrapText(tag, Math.max(100, W - tagX - 10), 10.5, 600, t.font));
    tagLineCache.push(tagLines);
    y += gapY + (tagLines.length ? tagLines.length * 14 + 2 : 0) + (sideLab.rows[si] ? sideLab.rows[si] * 12 + 6 : 0);
  });
  const H = y - gapY + 12;
  // 본선 연결선: 가지가 끼면 왼쪽 가장자리로 우회
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i], b = trunk[i + 1];
    const busy = steps[i].chains.length > 0;
    const kind: StrokeKind = steps[i].dashed ? 'ref' : 'flow'; const tl = tagLineCache[i] || [];
    const tx = mL + nodeW / 2 + 8, xm = mL + nodeW / 2;
    // 가지가 끼면 아래 꼭짓점에서 나와 왼쪽 가장자리로 우회한 뒤, 대상 위 18px 에서 가운데로 돌아와 직각으로 들어간다
    if (busy) { const lx = mL + 10; svg += pathEl(`M${xm} ${a.y + a.h + 1} V${a.y + a.h + 10} H${lx} V${b.y - 18} H${xm} V${b.y - 3}`, kind, t, uid, { edge: [a.id, b.id] }); }
    else svg += pathEl(`M${xm} ${a.y + a.h + 1} L${xm} ${b.y - 3}`, kind, t, uid, { edge: [a.id, b.id] });
    tl.forEach((ln, k) => { svg += svgText(tx, b.y - 7 - (tl.length - 1 - k) * 14, ln, { size: 10.5, weight: 600, fill: t.green }, t); });
  }
  {
    const byTarget = new Map<number, number[]>();
    chainCols.forEach((col, ci) => { const k = col.chain.rejoin; if (k === null) return; if (!byTarget.has(k)) byTarget.set(k, []); byTarget.get(k)!.push(ci); });
    for (const [k, list] of byTarget) {
      const rj = trunk[k]; const mid = rj.y + rj.h / 2;
      const srcY = (ci: number) => { const pl = chainCols[ci].placed; const lp = pl[pl.length - 1]; return lp.y + lp.h / 2; };
      const place = (arr: number[], base: number) => { const ys = portYs(arr.length, rj.y, rj.h, base); arr.forEach((ci, j) => nRejoinPortY.set(ci, ys[j])); };
      place(list.filter(ci => srcY(ci) <= mid), 0.25);
      place(list.filter(ci => srcY(ci) > mid), 0.75);
    }
    let lane = 0;
    chainCols.forEach((col, ci) => { if (col.chain.rejoin !== null && col.chain.rejoin !== col.step + 1) nRejoinLane.set(ci, 6 * (lane++)); });
  }
  // 가지 연결선
  chainCols.forEach((col, ci) => {
    const from = trunk[col.step]; const first = col.placed[0]; const last = col.placed[col.placed.length - 1];
    const kind: StrokeKind = col.chain.dashed ? 'ref' : 'flow';
    const cx = first.x + Math.min(40, first.w / 2);
    const vx = from.x + from.w / 2;
    if (col.chainIndex > 0) {
      // v3.95.1: 같은 본선 노드의 둘째 이후 가지는 앞 가지 상자들 아래에 놓인다.
      //   곧장 내려가면 앞 가지 상자를 관통하므로, 들여쓰기 빈 칸(본선 왼쪽 가장자리~가지 왼쪽 사이)을
      //   통로로 써서 내려간 뒤 가지 왼쪽 면으로 직각 진입한다.
      const bx = Math.min(mL + 22, mL + 14 + 2 * (col.chainIndex - 1));
      const ey = first.y + first.h / 2;
      // v3.98.1: 폰 폭은 벌릴 자리가 없어 아래 꼭짓점 하나에서 나가는 '버스' 를 유지하되, 갈라지는 지점을 가지마다 6px 씩 다르게
      const turn = from.y + from.h + 16 + 6 * Math.max(0, col.chainIndex);
      svg += pathEl(`M${vx} ${from.y + from.h + 1} V${turn} H${bx} V${ey} H${first.x - 3}`, kind, t, uid, { edge: [from.id, first.id] });
    } else {
      // 출발 노드가 마름모이거나 가지 세로선이 출발 노드 아래에 없으면 아래 꼭짓점에서 나와 10px 내려간 뒤 꺾는다
      const direct = from.shape !== 'decision' && cx >= from.x + 8 && cx <= from.x + from.w - 8;
      // v3.98.1: 본선 연결선의 첫 꺾임(+10)과 겹치지 않게 가지는 +16 에서 꺾는다
      svg += pathEl(direct ? `M${cx} ${from.y + from.h + 1} L${cx} ${first.y - 3}` : `M${vx} ${from.y + from.h + 1} V${from.y + from.h + 16} H${cx} V${first.y - 3}`, kind, t, uid, { edge: [from.id, first.id] });
    }
    if (col.chain.tag) {
      const tls = wrapText(col.chain.tag, Math.max(80, W - mR - (cx + 8) - 12), 10.5, 600, t.font);
      const lw = Math.max(...tls.map(l => measureText(l, 10.5, 600, t.font))) + 12; const ty = first.y - 6 - tls.length * 16;
      svg += svgEl('rect', { x: cx + 8, y: ty, width: lw, height: tls.length * 16 + 2, rx: 4, fill: t.surface, stroke: t.green, 'stroke-width': 1 });
      tls.forEach((ln, k) => { svg += svgText(cx + 14, ty + 13 + k * 16, ln, { size: 10.5, weight: 600, fill: t.green }, t); });
    }
    for (let k = 0; k < col.placed.length - 1; k++) { const p = col.placed[k], q = col.placed[k + 1]; const xx = p.x + Math.min(40, p.w / 2); svg += pathEl(`M${xx} ${p.y + p.h + 1} L${xx} ${q.y - 3}`, 'flow', t, uid, { edge: [p.id, q.id] }); }
    if (col.chain.rejoin !== null) {
      const rj = trunk[col.chain.rejoin]; const lx = last.x + Math.min(40, last.w / 2);
      // 합류점이 바로 아래면 세로로, 더 아래·위면 오른쪽 통로로 돌아 옆면 포트로 직각 진입
      // v3.95.1: 이 가지 아래에 같은 단계의 다른 가지가 더 있으면 곧장 내려가면 그 상자를 관통한다 → 오른쪽 통로
      const isLastChainOfStep = !chainCols.some(c2 => c2.step === col.step && c2.chainIndex > col.chainIndex);
      if (rj === trunk[col.step + 1] && isLastChainOfStep) svg += pathEl(`M${lx} ${last.y + last.h + 1} L${lx} ${rj.y - 3}`, kind, t, uid, { edge: [last.id, rj.id] });
      else { const rx = mL + nodeW + 14 + (nRejoinLane.get(ci) || 0); const ry = nRejoinPortY.get(ci) ?? (rj.y + rj.h / 2); svg += pathEl(`M${last.x + last.w + 1} ${last.y + last.h / 2} H${rx} V${ry} L${rj.x + rj.w + 3} ${ry}`, kind, t, uid, { edge: [last.id, rj.id] }); }
    }
  });
  // 되돌림·건너뜀(왼쪽 통로, 선마다 6px 씩 바깥): 출발 노드 옆면에서 나가 대상 노드 옆면으로 직각 진입. 라벨은 통로 옆, 두 노드 사이 빈 칸에
  let side = 0;
  /** 미리 배정한 칸 k 의 row 번째 줄 기준선 y: 다음 노드 위 본선 태그 바로 위에서 위로 쌓는다 */
  const sideLabelY = (k: number, row: number) => { const tl = tagLineCache[k] || []; const tagH = tl.length ? tl.length * 14 + 2 : 0; return trunk[k + 1].y - tagH - 10 - (sideLab.rows[k] - 1 - row) * 12; };
  // v3.92.3: 같은 노드로 들어오는 되돌림·건너뜀이 여럿이면 왼쪽 면 위(0.25)/아래(0.75) 포트로 나눈다
  const sideList: Array<{ i: number; j: number; to: number; kind: StrokeKind }> = [];
  steps.forEach((st, i) => sideEdges(st).forEach((se, j) => sideList.push({ i, j, to: se.to, kind: se.kind })));
  const sidePortY = new Map<number, number>();
  {
    const byTarget = new Map<number, number[]>();
    sideList.forEach((sl, k) => { if (!byTarget.has(sl.to)) byTarget.set(sl.to, []); byTarget.get(sl.to)!.push(k); });
    for (const [to, list] of byTarget) {
      const b = trunk[to]; const mid = b.y + b.h / 2;
      const place = (arr: number[], base: number) => { const ys = portYs(arr.length, b.y, b.h, base); arr.forEach((k, j) => sidePortY.set(k, ys[j])); };
      place(list.filter(k => trunk[sideList[k].i].y + trunk[sideList[k].i].h / 2 <= mid), 0.25);
      place(list.filter(k => trunk[sideList[k].i].y + trunk[sideList[k].i].h / 2 > mid), 0.75);
    }
  }
  // v3.98.1: 같은 노드에서 나가는 되돌림·건너뜀이 여럿이면 왼쪽 면 출발점도 나눈다
  const sideOutIdx = new Map<number, [number, number]>();
  {
    const byFrom = new Map<number, number[]>();
    sideList.forEach((sl, k) => { const l = byFrom.get(sl.i) || []; l.push(k); byFrom.set(sl.i, l); });
    for (const list of byFrom.values()) list.forEach((k, idx) => sideOutIdx.set(k, [idx, list.length]));
  }
  sideList.forEach((sl, k) => {
    const i = sl.i, j = sl.j;
    const a = trunk[i], b = trunk[sl.to]; const lx = mL - 12 - (side++) * 10;
    const ey = sidePortY.get(k) ?? (b.y + b.h / 2);
    const oi = sideOutIdx.get(k) || [0, 1];
    const sp = exitPoint(a, 'left', oi[0], oi[1]);
    svg += pathEl(`M${sp.x - 1} ${sp.y} H${lx} V${ey} H${b.x - 3}`, sl.kind, t, uid, { edge: [a.id, b.id] });
    const lab = sideLab.at.get(`${i}:${j}`); if (lab) lab.lines.forEach((ln, r) => { svg += svgText(mL - 7, sideLabelY(lab.k, lab.row + r), ln, { size: 10, fill: t.text2 }, t); });
  });
  const drawNode = (p: Placed, weight: number) => {
    svg += nodeBox(p.x, p.y, p.w, p.h, p.shape, t, p.id);
    const top = p.y + (p.h - p.lines.length * 16) / 2;
    svg += drawLines(p.x + p.w / 2, top, p.lines, p.head, SZ, weight, 'middle', t, p.sys);
  };
  trunk.forEach(p => drawNode(p, 600)); extras.forEach(p => drawNode(p, 500));
  // 잎·입력 항목
  steps.forEach((_st, i) => { svg = drawItems(svg, itemLays[i], trunk[i], itemY[i], t, trunk[i].id); });
  return svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + svg);
}

function drawBranch(g: FlowGraph, width: number, t: IslandTokens): string {
  if (width < 520) return drawBranchNarrow(g, width, t);
  const uid = nextUid();
  const steps = buildBranch(g);
  const SZ = 12.5, pad = 12, W = Math.max(300, width);
  const sideN = steps.reduce((a, st) => a + st.loops.length + st.skips.length, 0); const hasLoop = sideN > 0;
  const mL = hasLoop ? 34 + 10 * sideN : 12, mT = 12, gapY = 30, gapX = 30, rowGap = 12;
  const labelOf = (id: string) => g.nodes.get(id)!.label;
  // 본선 노드 폭: 라벨 최대 폭에 맞추되 220 을 넘기지 않는다
  let tw = 0; for (const s of steps) tw = Math.max(tw, labelWidth(labelOf(s.id), SZ, 600, t.font));
  const nodeW = Math.min(300, Math.max(150, Math.ceil(tw) + 2 * pad));
  const chainNodeW = (id: string) => Math.min(220, Math.max(110, Math.ceil(labelWidth(labelOf(id), SZ, 600, t.font)) + 2 * pad));
  // 본선 라벨 배치(결정은 마름모 크기). 본선 축 폭 = 가장 넓은 것: 마름모가 상자보다 넓어도 축은 한 줄로
  const trunkLay = steps.map(st => nodeLayout(labelOf(st.id), g.nodes.get(st.id)!.shape, nodeW, pad, SZ, t.font));
  const axisW = Math.max(nodeW, ...trunkLay.map(l => l.w));
  // 세로 배치
  type Placed = { id: string; x: number; y: number; w: number; h: number; lines: string[]; head: number; sys: boolean; shape?: FlowShape };
  const trunk: Placed[] = []; const extras: Placed[] = []; let svg = ''; let y = mT; let maxX = mL + axisW;
  const chainRows: Array<{ step: number; chain: Chain; y: number; placed: Placed[]; chainIndex: number }> = [];
  const tagLineCache: string[][] = []; const itemLays: ReturnType<typeof layoutItems>[] = []; const rowBottoms: number[] = [];
  const sideLab = assignSideLabels(steps, Math.max(60, axisW / 2), t.font);
  steps.forEach((st, si) => {
    const ll = trunkLay[si]; const lines = ll.lines; const h = ll.h;
    const p: Placed = { id: st.id, x: mL + (axisW - ll.w) / 2, y, w: ll.w, h, lines, head: ll.head, sys: ll.sys, shape: g.nodes.get(st.id)!.shape };
    trunk.push(p);
    // 가지 행: 첫 가지는 노드와 같은 높이, 다음 가지는 아래 행
    let rowY = y, rowH = h;
    st.chains.forEach((ch, k) => {
      if (k > 0) rowY += rowH + rowGap;
      const tagW = ch.tag ? measureText(ch.tag, 10.5, 600, t.font) + 12 + 8 : 0;
      let x = mL + axisW + gapX + (k > 0 ? 18 : 0) + tagW; // 태그 자리
      const placed: Placed[] = [];
      for (const id of ch.nodes) {
        const shp = g.nodes.get(id)!.shape; const cl = nodeLayout(labelOf(id), shp, chainNodeW(id), pad, SZ, t.font); const ls = cl.lines; const hh = cl.h; const w = cl.w;
        placed.push({ id, x, y: k === 0 ? rowY + (h - hh) / 2 : rowY, w, h: hh, lines: ls, head: cl.head, sys: cl.sys, shape: shp });
        x += w + gapX;
      }
      maxX = Math.max(maxX, x - gapX + 20);
      chainRows.push({ step: trunk.length - 1, chain: ch, y: rowY, placed, chainIndex: k });
      extras.push(...placed);
      rowH = Math.max(k === 0 ? h : 0, ...placed.map(q => q.y + q.h - rowY)); // 이 행의 실제 높이
    });
    // 잎·입력 항목(노드 아래 작은 줄, 남은 폭에 맞춰 줄바꿈)
    const lay = layoutItems(st, p.x + 18, W, t); itemLays.push(lay); maxX = Math.max(maxX, lay.maxX);
    const rowsBottom = Math.max(y + h, rowY + rowH); rowBottoms.push(rowsBottom);
    const bottom = rowsBottom + lay.h;
    const tagLines = st.tags.flatMap(tag => wrapText(tag, Math.max(120, W - (mL + axisW / 2 + 8) - 12), 10.5, 600, t.font));
    tagLineCache.push(tagLines);
    y = bottom + gapY + (tagLines.length ? tagLines.length * 14 + 2 : 0) + (sideLab.rows[si] ? sideLab.rows[si] * 12 + 6 : 0);
  });
  const H = y - gapY + 12;
  // 본선 화살표 + 태그
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i], b = trunk[i + 1], xm = mL + axisW / 2;
    svg += pathEl(`M${xm} ${a.y + a.h + 1} L${xm} ${b.y - 3}`, steps[i].dashed ? 'ref' : 'flow', t, uid, { edge: [a.id, b.id] });
    const tl = tagLineCache[i] || []; tl.forEach((ln, k) => { svg += svgText(xm + 8, b.y - 7 - (tl.length - 1 - k) * 14, ln, { size: 10.5, weight: 600, fill: t.green }, t); maxX = Math.max(maxX, xm + 8 + measureText(ln, 10.5, 600, t.font) + 6); });
  }
  // v3.92.3: 본선 노드 오른쪽 면 포트 분산 — 출발선은 가운데(0.5), 합류선은 오는 방향에 따라 위(0.25)/아래(0.75) 절반에 나눠 붙인다.
  //   같은 방향 합류가 둘 이상이면 그 절반 안에서 9px 간격으로 균등 분할(노드 높이가 모자라면 안쪽으로 좁힌다).
  const rejoinPortY = new Map<number, number>();   // chainRows 인덱스 → 합류 진입 y
  const rejoinLane = new Map<number, number>();    // chainRows 인덱스 → 합류 통로 바깥 여유(0, 6, 12 …)
  {
    const byTarget = new Map<number, number[]>();
    chainRows.forEach((row, ri) => {
      if (row.chain.rejoin === null) return;
      const k = row.chain.rejoin;
      if (!byTarget.has(k)) byTarget.set(k, []);
      byTarget.get(k)!.push(ri);
    });
    for (const [k, list] of byTarget) {
      const rj = trunk[k]; const mid = rj.y + rj.h / 2;
      const srcY = (ri: number) => { const pl = chainRows[ri].placed; const lp = pl[pl.length - 1]; return lp.y + lp.h / 2; };
      const above = list.filter(ri => srcY(ri) <= mid);   // 위에서 내려오는 합류
      const below = list.filter(ri => srcY(ri) > mid);    // 아래에서 올라오는 합류
      const place = (arr: number[], base: number) => { const ys = portYs(arr.length, rj.y, rj.h, base); arr.forEach((ri, j) => rejoinPortY.set(ri, ys[j])); };
      place(above, 0.25); place(below, 0.75);
    }
    let lane = 0;
    chainRows.forEach((row, ri) => { if (row.chain.rejoin !== null) rejoinLane.set(ri, 6 * (lane++)); });
  }
  // v3.95.1: 합류 대상 본선 노드에 **행 0 가지**가 있으면 오른쪽 면으로 들어올 수 없다.
  //   행 0 가지는 본선 노드와 같은 높이라, 오른쪽 면의 어느 포트로 들어와도 그 가지 상자를 가로지른다.
  //   → 위에서 오는 합류는 위쪽 면, 아래에서 오는 합류는 아래쪽 면으로 직각 진입한다.
  const rejoinFace = new Map<number, 'top' | 'bottom'>();   // chainRows 인덱스 → 진입 면
  const rejoinPortX = new Map<number, number>();            // 진입 x
  const rejoinHY = new Map<number, number>();               // 가로 통로 y
  {
    const row0 = new Map<number, Placed[]>();
    chainRows.forEach(r => { if (r.chainIndex !== 0) return; const l = row0.get(r.step) || []; l.push(...r.placed); row0.set(r.step, l); });
    const byTarget = new Map<number, number[]>();
    chainRows.forEach((row, ri) => {
      if (row.chain.rejoin === null) return;
      if (!row0.has(row.chain.rejoin)) return;   // 행 0 가지가 없으면 기존(오른쪽 면 포트) 그대로
      const k = row.chain.rejoin;
      if (!byTarget.has(k)) byTarget.set(k, []);
      byTarget.get(k)!.push(ri);
    });
    for (const [k, list] of byTarget) {
      const rj = trunk[k]; const mid = rj.y + rj.h / 2; const siblings = row0.get(k)!;
      const srcY = (ri: number) => { const pl = chainRows[ri].placed; const lp = pl[pl.length - 1]; return lp.y + lp.h / 2; };
      const above = list.filter(ri => srcY(ri) <= mid);
      const below = list.filter(ri => srcY(ri) > mid);
      // 가로 통로는 행 0 가지 상자 바깥으로 14px
      const topY = Math.min(rj.y, ...siblings.map(q => q.y)) - 14;
      const botY = Math.max(rj.y + rj.h, ...siblings.map(q => q.y + q.h)) + 14;
      // 아래쪽 면 진입은 잎·입력 항목 글자 위를 지나므로, 세로 구간을 항목 오른쪽 끝 바깥으로 민다
      const itemsRight = itemLays[k] ? itemLays[k].maxX : 0;
      const baseBottom = rj.x + rj.w * 0.8 > itemsRight ? 0.8 : (rj.w - 8) / rj.w;
      const place = (arr: number[], face: 'top' | 'bottom', hy: number, base: number) => {
        const xs = portXs(arr.length, rj.x, rj.w, base);
        arr.forEach((ri, j) => { rejoinFace.set(ri, face); rejoinPortX.set(ri, xs[j]); rejoinHY.set(ri, hy); });
      };
      place(above, 'top', topY, 0.8);
      place(below, 'bottom', botY, baseBottom);
    }
  }
  /** v3.95.1: 합류 통로(세로 구간)가 지나는 y 구간과 겹치는 가지 상자가 있으면 그 오른쪽으로 물린다 */
  const clearRx = (base: number, top: number, bot: number): number => {
    let r = base;
    for (const q of extras) if (q.y < bot + 2 && q.y + q.h > top - 2) r = Math.max(r, q.x + q.w + 14);
    return r;
  };
  // 가지 연결선
  chainRows.forEach((row, ri) => {
    const from = trunk[row.step]; const first = row.placed[0]; const last = row.placed[row.placed.length - 1];
    const kind: StrokeKind = row.chain.dashed ? 'ref' : 'flow';
    const sameRow = Math.abs(row.y - from.y) < 1;
    const ym = first.y + first.h / 2;
    // v3.98.1: 한 본선 노드에서 오른쪽으로 나가는 가지가 여럿이면 **출발점도 나눈다**
    //   (전에는 전부 오른쪽 면 가운데 한 점에서 나가 통로에서야 갈라졌다).
    const outN = chainRows.filter(r2 => r2.step === row.step).length;
    const sp = exitPoint(from, 'right', row.chainIndex, outN);
    // 통로: 행마다 6px 씩 바깥. v3.98.0 대로 행 0 가지 상자 왼쪽 빈 칸 안에 가둔다
    const row0Left = Math.min(...chainRows.filter(r2 => r2.step === row.step && r2.chainIndex === 0)
      .flatMap(r2 => r2.placed.map(q => q.x)), Infinity);
    const lo = sp.x + 6, hi = Number.isFinite(row0Left) ? row0Left - 8 : Infinity;
    const bx = Math.max(lo, Math.min(hi, from.x + from.w + 14 + 6 * Math.max(0, row.chainIndex)));
    if (sameRow && Math.abs(sp.y - ym) < 1) {
      svg += pathEl(`M${sp.x + 1} ${sp.y} L${first.x - 3} ${ym}`, kind, t, uid, { edge: [from.id, first.id] });
    } else {
      svg += pathEl(`M${sp.x + 1} ${sp.y} H${bx} V${ym} L${first.x - 3} ${ym}`, kind, t, uid, { edge: [from.id, first.id] });
      maxX = Math.max(maxX, bx + 8);
    }
    if (row.chain.tag) {
      const lw = measureText(row.chain.tag, 10.5, 600, t.font) + 12; const tx = first.x - 8 - lw, ty = ym - 9;
      svg += svgEl('rect', { x: tx, y: ty, width: lw, height: 18, rx: 4, fill: t.surface, stroke: t.green, 'stroke-width': 1 });
      svg += svgText(tx + 6, ym + 4, row.chain.tag, { size: 10.5, weight: 600, fill: t.green }, t);
    }
    for (let k = 0; k < row.placed.length - 1; k++) { const p = row.placed[k], q = row.placed[k + 1]; const yy = p.y + p.h / 2; svg += pathEl(`M${p.x + p.w + 1} ${yy} L${q.x - 3} ${yy}`, 'flow', t, uid, { edge: [p.id, q.id] }); }
    if (row.chain.rejoin !== null) {
      const rj = trunk[row.chain.rejoin];
      const lastY = last.y + last.h / 2;
      const face = rejoinFace.get(ri);
      const turnY = face ? (rejoinHY.get(ri) as number) : (rejoinPortY.get(ri) ?? (rj.y + rj.h / 2));
      const rx = clearRx(last.x + last.w + 14, Math.min(lastY, turnY), Math.max(lastY, turnY)) + (rejoinLane.get(ri) || 0);
      if (face) {
        const ex = rejoinPortX.get(ri) as number;
        const ey = face === 'top' ? rj.y - 3 : rj.y + rj.h + 3;
        svg += pathEl(`M${last.x + last.w + 1} ${lastY} H${rx} V${turnY} H${ex} V${ey}`, kind, t, uid, { edge: [last.id, rj.id] });
      } else {
        svg += pathEl(`M${last.x + last.w + 1} ${lastY} H${rx} V${turnY} L${rj.x + rj.w + 3} ${turnY}`, kind, t, uid, { edge: [last.id, rj.id] });
      }
      maxX = Math.max(maxX, rx + 8);
    }
  });
  // 되돌림·건너뜀(왼쪽 통로): 출발 노드 옆면에서 나가 통로를 타고 대상 노드 옆면으로 직각 진입. 라벨은 통로 옆, 두 노드 사이 빈 칸에.
  let side = 0;
  /** 미리 배정한 칸 k 의 row 번째 줄 기준선 y: 다음 노드 위 본선 태그 바로 위에서 위로 쌓는다 */
  const sideLabelY = (k: number, row: number) => { const tl = tagLineCache[k] || []; const tagH = tl.length ? tl.length * 14 + 2 : 0; return trunk[k + 1].y - tagH - 10 - (sideLab.rows[k] - 1 - row) * 12; };
  // v3.92.3: 같은 노드로 들어오는 되돌림·건너뜀이 여럿이면 왼쪽 면 위(0.25)/아래(0.75) 포트로 나눈다
  const sideList: Array<{ i: number; j: number; to: number; kind: StrokeKind }> = [];
  steps.forEach((st, i) => sideEdges(st).forEach((se, j) => sideList.push({ i, j, to: se.to, kind: se.kind })));
  const sidePortY = new Map<number, number>();
  {
    const byTarget = new Map<number, number[]>();
    sideList.forEach((sl, k) => { if (!byTarget.has(sl.to)) byTarget.set(sl.to, []); byTarget.get(sl.to)!.push(k); });
    for (const [to, list] of byTarget) {
      const b = trunk[to]; const mid = b.y + b.h / 2;
      const place = (arr: number[], base: number) => { const ys = portYs(arr.length, b.y, b.h, base); arr.forEach((k, j) => sidePortY.set(k, ys[j])); };
      place(list.filter(k => trunk[sideList[k].i].y + trunk[sideList[k].i].h / 2 <= mid), 0.25);
      place(list.filter(k => trunk[sideList[k].i].y + trunk[sideList[k].i].h / 2 > mid), 0.75);
    }
  }
  // v3.98.1: 같은 노드에서 나가는 되돌림·건너뜀이 여럿이면 왼쪽 면 출발점도 나눈다
  const sideOutIdx = new Map<number, [number, number]>();
  {
    const byFrom = new Map<number, number[]>();
    sideList.forEach((sl, k) => { const l = byFrom.get(sl.i) || []; l.push(k); byFrom.set(sl.i, l); });
    for (const list of byFrom.values()) list.forEach((k, idx) => sideOutIdx.set(k, [idx, list.length]));
  }
  sideList.forEach((sl, k) => {
    const i = sl.i, j = sl.j;
    const a = trunk[i], b = trunk[sl.to]; const lx = mL - 14 - (side++) * 10;
    const ey = sidePortY.get(k) ?? (b.y + b.h / 2);
    const oi = sideOutIdx.get(k) || [0, 1];
    const sp = exitPoint(a, 'left', oi[0], oi[1]);
    svg += pathEl(`M${sp.x - 1} ${sp.y} H${lx} V${ey} H${b.x - 3}`, sl.kind, t, uid, { edge: [a.id, b.id] });
    const lab = sideLab.at.get(`${i}:${j}`); if (lab) lab.lines.forEach((ln, r) => { svg += svgText(mL - 9, sideLabelY(lab.k, lab.row + r), ln, { size: 10, fill: t.text2 }, t); });
  });
  // 노드
  const drawNode = (p: Placed, weight: number) => {
    svg += nodeBox(p.x, p.y, p.w, p.h, p.shape, t, p.id);
    const top = p.y + (p.h - p.lines.length * 16) / 2;
    svg += drawLines(p.x + p.w / 2, top, p.lines, p.head, SZ, weight, 'middle', t, p.sys);
  };
  trunk.forEach(p => drawNode(p, 600)); extras.forEach(p => drawNode(p, 500));
  // 잎·입력 항목
  steps.forEach((_st, i) => {
    const p = trunk[i]; const yy = rowBottoms[i] + 16;
    svg = drawItems(svg, itemLays[i], p, yy, t, p.id);
  });
  const SW = Math.max(maxX + 12, Math.min(W, maxX + 12));
  return svgEl('svg', { width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + svg);
}

// ────────────────────────────────────────────────────────────────────────────
// cause (뿌리 → 원인 → 결과)
// ────────────────────────────────────────────────────────────────────────────

export interface CauseExtra { priority: Map<string, { level: string; note: string }> }

/** 우선순위 표의 항목 이름과 원인 라벨을 느슨하게 맞춘다(공백·기호 제거 후 포함 관계 또는 2글자 이상 토큰 2개 공유). */
function matchPriority(label: string, prio: Map<string, { level: string; note: string }>): { level: string; note: string } | undefined {
  const norm = (s: string) => s.replace(/[\s·,/()`'"]/g, '').toLowerCase();
  const nl = norm(label);
  for (const [item, v] of prio) { const ni = norm(item); if (ni && (nl.includes(ni) || ni.includes(nl))) return v; }
  const toks = label.split(/[\s·,/()]+/).filter(x => x.length >= 2);
  let best: { v: { level: string; note: string }; n: number } | null = null;
  for (const [item, v] of prio) { const n = toks.filter(x => item.includes(x)).length; if (n >= 2 && (!best || n > best.n)) best = { v, n }; }
  return best?.v;
}

function drawCause(g: FlowGraph, width: number, t: IslandTokens, extra?: CauseExtra): string {
  const uid = nextUid();
  const d = degrees(g, true);
  const root = Array.from(g.nodes.keys()).find(id => (d.indeg.get(id) || 0) === 0)!;
  const rows = (d.out.get(root) || []).map(e => {
    const cause = g.nodes.get(e.to)!;
    const eff = (d.out.get(e.to) || [])[0];
    const label = cause.label.replace(/\n/g, ' ');
    const pr = extra ? matchPriority(label, extra.priority) : undefined;
    const high = !!pr && /high|높음|상|긴급|critical|1/i.test(pr.level);
    return { causeId: e.to, effectId: eff ? eff.to : '', cause: label, effect: eff ? g.nodes.get(eff.to)!.label.replace(/\n/g, ' ') : '', strong: e.thick || eff?.thick === true || high, dashed: e.dashed, level: pr?.level || '', note: pr?.note || '' };
  });
  // 남은 짝이 하나씩이면 그대로 맺어준다 (예: "SimBD 대표 데이터 선정 로직 미수립" ↔ "SimBD ①②③ flow 일정 확정")
  if (extra) {
    const usedNotes = new Set(rows.filter(r => r.level || r.note).map(r => r.note));
    const leftRows = rows.filter(r => !r.level && !r.note);
    const leftPrio = [...extra.priority.values()].filter(v => !usedNotes.has(v.note));
    if (leftRows.length === 1 && leftPrio.length === 1) { const v = leftPrio[0]; leftRows[0].level = v.level; leftRows[0].note = v.note; leftRows[0].strong = leftRows[0].strong || /high|높음|상|긴급|critical|1/i.test(v.level); }
  }
  // 우선순위가 있으면 High 먼저
  if (extra) rows.sort((a, b) => Number(b.strong) - Number(a.strong));
  const W = Math.max(320, width), gap = Math.min(110, Math.max(64, W * 0.15)), colW = (W - gap - 16) / 2, pad = 12, SZ = 12.5;
  const laid = rows.map(r => {
    const cl = wrapBalanced(r.cause, colW - 2 * pad, SZ, 600, t.font), el = wrapBalanced(r.effect || '', colW - 2 * pad, SZ, 600, t.font);
    const nl = r.note ? wrapBalanced(r.note, colW - 2 * pad, 11, 400, t.font) : [];
    const hR = el.length * 16 + 20 + (nl.length ? nl.length * 14 + 4 : 0);
    return { ...r, cl, el, nl, h: Math.max(cl.length * 16 + 20, hR) };
  });
  let y = 12, s = '';
  const rootLabel = g.nodes.get(root)!.label.replace(/\n/g, ' ');
  s += svgText(8, y, rootLabel, { size: 11, weight: 600, fill: t.text2 }, t);
  s += svgText(8 + colW + gap, y, '결과', { size: 11, weight: 600, fill: t.text2 }, t);
  y += 12;
  for (const rw of laid) {
    const x1 = 8, x2 = 8 + colW + gap;
    s += svgEl('g', { 'data-ww-node': rw.causeId, 'data-ww-box': `${Math.round(x1)},${Math.round(y)},${Math.round(colW)},${Math.round(rw.h)}`, 'data-ww-shape': 'box' },
      svgEl('rect', { x: x1, y, width: colW, height: rw.h, rx: 6, fill: t.surface, stroke: rw.strong ? t.text : t.borderStrong, 'stroke-width': rw.strong ? 1.4 : 1 }));
    rw.cl.forEach((ln, k) => { s += svgText(x1 + colW / 2, y + 18 + k * 16, ln, { size: SZ, weight: 600, fill: t.text, anchor: 'middle' }, t); });
    if (rw.effect) {
      s += svgEl('g', { 'data-ww-node': rw.effectId, 'data-ww-box': `${Math.round(x2)},${Math.round(y)},${Math.round(colW)},${Math.round(rw.h)}`, 'data-ww-shape': 'box' },
        svgEl('rect', { x: x2, y, width: colW, height: rw.h, rx: 6, fill: t.surface, stroke: t.border, 'stroke-width': 1 }));
      rw.el.forEach((ln, k) => { s += svgText(x2 + colW / 2, y + 18 + k * 16, ln, { size: SZ, weight: 600, fill: t.text, anchor: 'middle' }, t); });
      rw.nl.forEach((ln, k) => { s += svgText(x2 + colW / 2, y + 18 + rw.el.length * 16 + 4 + k * 14, ln, { size: 11, fill: t.muted, anchor: 'middle' }, t); });
      const ym = y + rw.h / 2;
      s += pathEl(`M${x1 + colW + 2} ${ym} L${x2 - 4} ${ym}`, rw.strong ? 'no' : rw.dashed ? 'ref' : 'soft', t, uid, { edge: [rw.causeId, rw.effectId] });
      if (rw.level) s += svgText(x1 + colW + gap / 2, ym - 7, rw.level, { size: 10, weight: 500, fill: rw.strong ? t.red : t.muted, anchor: 'middle', family: t.mono }, t);
    }
    y += rw.h + 10;
  }
  return svgEl('svg', { width: W, height: y + 2, viewBox: `0 0 ${W} ${y + 2}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + s);
}

// ────────────────────────────────────────────────────────────────────────────
// map (subgraph 레인 + 직각 라우팅 + 분리 진입)
// ────────────────────────────────────────────────────────────────────────────

interface MapNode { id: string; label: string; x: number; y: number; w: number; h: number; col: number; lane: string; idx: number; hub: boolean; L: PortRef[]; R: PortRef[] }
interface MapEdge { from: string; to: string; kind: StrokeKind; bi: boolean; open?: boolean; a: MapNode; b: MapNode; type: 'fwd' | 'long' | 'back' | 'adj' | 'side'; side?: 'L' | 'R'; ay?: number; by?: number; slotX?: number }
interface PortRef { e: MapEdge; other: MapNode }

function drawMap(g: FlowGraph, t: IslandTokens, opts?: { lanes?: FlowSubgraph[]; onePerCol?: boolean }): string {
  const uid = nextUid();
  const SZ = 12, rowGap = 6, baseH = 26, laneGap = 26, colGap = 100, mL = 48, mR = 16, mT = 10, pad = 10, SLOT = 6, PORT = 6;
  // 레인 → 열 배치: 4열까지는 하나씩, 그 이상은 앞 둘은 단독·나머지는 둘씩 쌓기
  const lanes = (opts?.lanes ?? g.subgraphs).filter(sg => sg.nodes.length > 0);
  const columns: typeof lanes[] = [];
  if (opts?.onePerCol || lanes.length <= 4) lanes.forEach(l => columns.push([l]));
  else { columns.push([lanes[0]], [lanes[1]]); for (let i = 2; i < lanes.length; i += 2) columns.push(lanes.slice(i, i + 2)); }
  // 허브: 차수 상위 2개(차수 5 이상)
  const deg = new Map<string, number>();
  for (const e of g.edges) { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); }
  const hubs = new Set(Array.from(deg.entries()).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k));

  const nodes = new Map<string, MapNode>(); const all: MapNode[] = [];
  const colW: number[] = [], colX: number[] = []; let cx = mL;
  columns.forEach((col, ci) => {
    let w = 0;
    col.forEach(ln => { ln.nodes.forEach(id => { const nd = g.nodes.get(id)!; w = Math.max(w, measureText(nd.label.replace(/\n/g, ' '), SZ, hubs.has(id) ? 700 : 500, t.font)); }); w = Math.max(w, measureText(ln.title, 11, 600, t.font) - 10); });
    colW[ci] = Math.ceil(w) + 2 * pad; colX[ci] = cx; cx += colW[ci] + colGap;
    col.forEach(ln => ln.nodes.forEach((id, ni) => {
      const nd = g.nodes.get(id)!;
      const o: MapNode = { id, label: nd.label.replace(/\n/g, ' '), x: colX[ci], y: 0, w: colW[ci], h: baseH, col: ci, lane: ln.id, idx: ni, hub: hubs.has(id), L: [], R: [] };
      nodes.set(id, o); all.push(o);
    }));
  });
  const totalW = cx - colGap + mR, ncol = columns.length;
  // v3.95.1: 마름모는 상자보다 좌우 24px 넓게 그려진다(nodeBox(nd.x-24, …, nd.w+48, …)).
  //   열 옆 통로를 colX/colX+colW 기준으로 잡으면 그 확장 상자 안을 세로선이 지나간다 → 열의 실제 좌우 끝을 쓴다.
  const colLeft: number[] = [], colRight: number[] = [];
  for (let c = 0; c < ncol; c++) { colLeft[c] = colX[c]; colRight[c] = colX[c] + colW[c]; }
  for (const nd of all) if (g.nodes.get(nd.id)?.shape === 'decision') { colLeft[nd.col] = Math.min(colLeft[nd.col], nd.x - 24); colRight[nd.col] = Math.max(colRight[nd.col], nd.x + nd.w + 24); }
  /** 열 c 왼쪽 빈 칸의 통로 x — 앞 열 오른쪽 끝(없으면 왼쪽 여백)을 넘지 않는다 */
  //   통로가 여러 개면 빈 칸 폭에 맞춰 간격을 좁힌다 — 클램프만 하면 여러 선이 같은 x 에 겹쳐 한 레인이 된다.
  const leftLaneUses: number[] = []; for (let c = 0; c < ncol; c++) leftLaneUses[c] = 0;
  const leftLaneX = (c: number, gap: number, k: number): number => {
    const limit = c > 0 ? colRight[c - 1] + 8 : 4;
    const start = colLeft[c] - gap;
    const n = Math.max(1, leftLaneUses[c]);
    let step = SLOT;
    if (n > 1 && start - (n - 1) * SLOT < limit) step = Math.max(1, (start - limit) / (n - 1));
    return Math.round(Math.max(limit, start - k * step));
  };
  // 통로가 마지막 열 오른쪽으로 나가면 그만큼 도표 폭을 넓힌다
  let outW = totalW;
  // 엣지: 양방향 합치기 + 유형
  const seen = new Map<string, number>(); const edges: MapEdge[] = [];
  for (const e of g.edges) {
    const a = nodes.get(e.from), b = nodes.get(e.to);
    if (!a || !b || a === b) continue;
    const k = `${e.from}>${e.to}`, rk = `${e.to}>${e.from}`;
    const prev = seen.get(rk);
    if (prev !== undefined) { edges[prev].bi = true; continue; }
    seen.set(k, edges.length);
    let kind: StrokeKind = e.dashed ? 'ref' : 'flow';
    if (!e.dashed && (a.hub || b.hub)) kind = 'strong';
    if (!e.dashed && a.hub && b.hub) kind = 'axis';
    if (e.thick) kind = 'axis';
    const me: MapEdge = { from: e.from, to: e.to, kind, bi: e.bidir, open: e.open, a, b, type: 'fwd' };
    if (b.col === a.col + 1) me.type = 'fwd'; else if (b.col > a.col + 1) me.type = 'long'; else if (b.col < a.col) me.type = 'back';
    else if (a.lane === b.lane && Math.abs(a.idx - b.idx) === 1) me.type = 'adj'; else me.type = 'side';
    if (me.type === 'fwd' || me.type === 'long') { a.R.push({ e: me, other: b }); b.L.push({ e: me, other: a }); }
    // v3.98.1: 되돌림도 출발 쪽 포트를 받는다(안 그러면 한 노드에서 나가는 되돌림이 전부 가운데 한 점)
    else if (me.type === 'back') { a.L.push({ e: me, other: b }); b.L.push({ e: me, other: a }); }
    else if (me.type === 'side') { me.side = a.col === 0 ? 'L' : 'R'; const la = me.side === 'R' ? a.R : a.L, lb = me.side === 'R' ? b.R : b.L; la.push({ e: me, other: b }); lb.push({ e: me, other: a }); }
    edges.push(me);
  }
  // 노드 높이(포트 수) + 세로 배치
  for (const nd of all) { const np = Math.max(nd.L.length, nd.R.length); nd.h = Math.max(baseH, 12 + PORT * (np - 1)); }
  let maxY = 0, laneS = '';
  columns.forEach((col, ci) => {
    let y = mT;
    col.forEach(ln => {
      if (ln.title) { laneS += svgText(colX[ci], y + 11, ln.title, { size: 11, weight: 600, fill: t.text2 }, t); y += 22; }
      ln.nodes.forEach(id => { const o = nodes.get(id)!; o.y = y; y += o.h + rowGap; });
      y += laneGap;
    });
    maxY = Math.max(maxY, y - laneGap);
  });
  // 포트 y
  for (const nd of all) for (const sd of ['L', 'R'] as const) {
    const list = nd[sd]; list.sort((p, q) => p.other.y - q.other.y);
    const n = list.length, step = n > 1 ? Math.min(PORT, (nd.h - 8) / (n - 1)) : 0;
    list.forEach((it, i) => { const py = nd.y + nd.h / 2 + (i - (n - 1) / 2) * step; if (it.e.a === nd) it.e.ay = py; else it.e.by = py; });
  }
  // 열 사이 통로: 아래쪽 출발·먼 목적지가 안쪽. 옆으로 도는 선은 세 번째 통로 이상.
  const slotsByCol: MapEdge[][] = []; for (let c = 0; c < ncol; c++) slotsByCol[c] = [];
  for (const e of edges) if (e.type === 'fwd' || e.type === 'long' || (e.type === 'side' && e.side === 'R')) slotsByCol[e.a.col].push(e);
  slotsByCol.forEach((list, c) => {
    list.sort((p, q) => { const dd = q.a.y - p.a.y; if (dd) return dd; return Math.abs(q.b.y - q.a.y) - Math.abs(p.b.y - p.a.y); });
    // v3.95.1: 통로가 다음 열 안으로 넘어가면 그 열 노드들을 세로선이 관통한다.
    //   → 빈 칸 폭에 맞춰 간격을 좁히고, 마지막 열이면 도표 폭을 넓힌다.
    const start = colRight[c] + 10;
    const gapEnd = c + 1 < ncol ? colLeft[c + 1] - 10 : Infinity;
    let slot = SLOT;
    const kMax = list.reduce((a, e, i) => Math.max(a, e.type === 'side' ? Math.max(i, 2) : i), 0);
    if (kMax > 0 && start + kMax * SLOT > gapEnd) slot = Math.max(1, (gapEnd - start) / kMax);
    let k = 0; list.forEach(e => { if (e.type === 'side') k = Math.max(k, 2); e.slotX = Math.round(Math.min(gapEnd, start + k * slot)); outW = Math.max(outW, (e.slotX || 0) + 12); k++; });
  });
  const leftSlots = edges.filter(e => e.type === 'side' && e.side === 'L');
  leftSlots.sort((p, q) => Math.abs(q.b.y - q.a.y) - Math.abs(p.b.y - p.a.y));
  leftSlots.forEach((e, i) => { e.slotX = leftLaneX(0, 10, i + 2); });
  // 경로
  // 왼쪽 통로를 몇 개 쓰는지 먼저 세어 간격을 정한다(leftLaneX)
  for (const e of edges) {
    if (e.type === 'back') { leftLaneUses[e.a.col] += 1; if (e.b.col > 0) leftLaneUses[e.b.col] += 1; }
    else if (e.type === 'long') leftLaneUses[e.b.col] += 1;
  }
  let chan = 0; const approach: number[] = []; for (let c = 0; c < ncol; c++) approach[c] = 0;
  // v3.95.1: 되돌아가는 선이 출발 노드 아래로 곧장 내려가면 같은 열의 아래 노드들을 전부 관통한다.
  //   → 왼쪽 면에서 나가 '그 열 왼쪽 빈 칸' 통로로 내려간다(열 사이 간격 100px 안이라 노드를 지나지 않는다).
  const backLane: number[] = []; for (let c = 0; c < ncol; c++) backLane[c] = 0;
  let eS = '';
  for (const e of edges) {
    const a = e.a, b = e.b, ay = e.ay ?? a.y + a.h / 2, by = e.by ?? b.y + b.h / 2, sx = e.slotX ?? 0;
    let pts: Array<[number, number]>;
    if (e.type === 'fwd') pts = Math.abs(ay - by) < 2 ? [[a.x + a.w + 1, ay], [b.x - 3, by]] : [[a.x + a.w + 1, ay], [sx, ay], [sx, by], [b.x - 3, by]];
    else if (e.type === 'long') { const cy = maxY + 10 + (chan++) * 8, apx = leftLaneX(b.col, 12, approach[b.col]++); pts = [[a.x + a.w + 1, ay], [sx, ay], [sx, cy], [apx, cy], [apx, by], [b.x - 3, by]]; }
    else if (e.type === 'back') {
      const cy = maxY + 10 + (chan++) * 8;
      const lx = b.col === 0 ? Math.max(4, colLeft[0] - 40) : leftLaneX(b.col, 12, approach[b.col]++);
      const bx = leftLaneX(a.col, 10, backLane[a.col]++);
      pts = [[a.x - 1, ay], [bx, ay], [bx, cy], [lx, cy], [lx, by], [b.x - 3, by]];
    }
    else if (e.type === 'adj') { const xm = a.x + a.w / 2, down = b.idx > a.idx; pts = down ? [[xm, a.y + a.h + 1], [xm, b.y - 3]] : [[xm, a.y - 1], [xm, b.y + b.h + 3]]; }
    else pts = e.side === 'R' ? [[a.x + a.w + 1, ay], [sx, ay], [sx, by], [b.x + b.w + 3, by]] : [[a.x - 1, ay], [sx, ay], [sx, by], [b.x - 3, by]];
    eS += pathEl(ortho(pts, 8), e.kind, t, uid, { startArrow: e.bi, noArrow: e.open, edge: [e.from, e.to] });
  }
  let nodeS = '';
  for (const nd of all) {
    const shp = g.nodes.get(nd.id)?.shape;
    nodeS += nd.hub ? svgEl('g', { 'data-ww-node': nd.id, 'data-ww-box': `${Math.round(nd.x)},${Math.round(nd.y)},${Math.round(nd.w)},${Math.round(nd.h)}`, 'data-ww-shape': 'hub' }, svgEl('rect', { x: nd.x, y: nd.y, width: nd.w, height: nd.h, rx: 5, fill: t.text, stroke: t.text, 'stroke-width': 1 }))
      : shp === 'decision' ? nodeBox(nd.x - 24, nd.y - 8, nd.w + 48, nd.h + 16, shp, t, nd.id) : nodeBox(nd.x, nd.y, nd.w, nd.h, shp, t, nd.id);
    nodeS += svgText(nd.x + nd.w / 2, nd.y + nd.h / 2 + 4.2, nd.label, { size: SZ, weight: nd.hub ? 700 : 500, fill: nd.hub ? t.surface : t.text, anchor: 'middle' }, t);
  }
  const H = maxY + 10 + chan * 8 + 12;
  const SW = Math.ceil(outW);
  return svgEl('svg', { width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + eS + nodeS + laneS);
}

// ────────────────────────────────────────────────────────────────────────────
// graph (ELK 층 배치 — 궤도·원인결과·지도 어디에도 안 맞는 그래프의 범용 배치)
// ────────────────────────────────────────────────────────────────────────────

/** elkjs 인스턴스의 최소 형태(`new ELK()`). 앱은 MarkdownPanel 이 lazy import 로 넘기고, 없으면 층별 지도(drawMap)로 그린다. */
export interface ElkLike { layout(graph: ElkGraphIn): Promise<ElkGraphOut> }
export interface ElkGraphIn {
  id: string; layoutOptions?: Record<string, string>;
  children: Array<{ id: string; width: number; height: number }>;
  edges: Array<{ id: string; sources: string[]; targets: string[]; labels?: Array<{ text: string; width: number; height: number }> }>;
}
interface ElkPt { x: number; y: number }
export interface ElkGraphOut {
  width?: number; height?: number;
  children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>;
  edges?: Array<{ id: string; sections?: Array<{ startPoint: ElkPt; endPoint: ElkPt; bendPoints?: ElkPt[] }>; labels?: Array<{ x?: number; y?: number; width?: number; height?: number; text?: string }> }>;
}

/** 관계 그래프를 ELK layered 로 배치해 그린다. 글자 크기 고정, 노드 크기는 우리가 잰다.
 *  방향: 원문이 LR/RL 이고 폭이 넉넉하면 가로, 그 밖(TD/TB 또는 폰 폭)은 세로. 직각 라우팅, 엣지 라벨은 칩. */
/** d3 curveBasis 와 같은 B-스플라인(Mermaid 기본 곡선). 꺾임점을 지나지 않고 둥글게 근사하되 양 끝은 정확히 지난다. */
function basisPath(pts: Array<[number, number]>): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  let x0 = pts[0][0], y0 = pts[0][1], x1 = pts[1][0], y1 = pts[1][1];
  d += ` L${(5 * x0 + x1) / 6} ${(5 * y0 + y1) / 6}`;
  const seg = (x: number, y: number) => { d += ` C${(2 * x0 + x1) / 3} ${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3} ${(y0 + 2 * y1) / 3} ${(x0 + 4 * x1 + x) / 6} ${(y0 + 4 * y1 + y) / 6}`; x0 = x1; y0 = y1; x1 = x; y1 = y; };
  for (let i = 2; i < pts.length; i++) seg(pts[i][0], pts[i][1]);
  seg(x1, y1);
  d += ` L${x1} ${y1}`;
  return d;
}

/** ELK 가 노드 상자 테두리에 붙인 끝점을 마름모 꼭짓점으로 옮긴다: 상자 밖 D px 지점에서 가운데로 간 뒤 직각으로 들어간다. */
function toDiamondVertex(pts: Array<[number, number]>, box: { x: number; y: number; w: number; h: number }, atEnd: boolean): Array<[number, number]> {
  const D = 14, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const [px, py] = atEnd ? pts[pts.length - 1] : pts[0];
  let jog: Array<[number, number]>;
  if (Math.abs(py - box.y) < 1) jog = [[px, box.y - D], [cx, box.y - D], [cx, box.y]];
  else if (Math.abs(py - (box.y + box.h)) < 1) jog = [[px, box.y + box.h + D], [cx, box.y + box.h + D], [cx, box.y + box.h]];
  else if (Math.abs(px - box.x) < 1) jog = [[box.x - D, py], [box.x - D, cy], [box.x, cy]];
  else jog = [[box.x + box.w + D, py], [box.x + box.w + D, cy], [box.x + box.w, cy]];
  if (Math.abs(jog[0][0] - jog[1][0]) < 1 && Math.abs(jog[0][1] - jog[1][1]) < 1) jog = [jog[2]]; // 이미 가운데
  return atEnd ? [...pts.slice(0, -1), ...jog] : [...jog.slice().reverse(), ...pts.slice(1)];
}

export interface GraphElkOptions { /** 꺾임을 Mermaid 처럼 B-스플라인 곡선으로 */ curve?: boolean }

export async function renderGraphElk(g: FlowGraph, width: number, elk: ElkLike, opts?: GraphElkOptions): Promise<string> {
  const t = resolveIslandTokens(); const uid = nextUid();
  const SZ = 12.5, pad = 12, M = 6;
  const narrow = width < 520;
  const maxLabelW = narrow ? Math.max(120, Math.min(220, width - 60)) : 220;
  const laid = new Map<string, { lines: string[]; head: number; sys: boolean; w: number; h: number }>();
  for (const n of g.nodes.values()) {
    if (n.shape === 'decision') { laid.set(n.id, decisionLayout(n.label, maxLabelW + 2 * pad, SZ, t.font)); continue; }
    const lw = Math.min(maxLabelW, Math.ceil(labelWidth(n.label, SZ, 600, t.font)));
    const ll = layoutLabel(n.label, Math.max(60, lw), SZ, t.font);
    const w = Math.max(84, Math.ceil(Math.max(...ll.lines.map(l => measureText(l, SZ, 600, t.font)))) + 2 * pad);
    // v3.98.0: 한 면에 선이 여럿 붙는 노드는 높이를 키운다 — 안 그러면 진입점이 3px 간격으로 붙는다(지도와 같은 규칙)
    let side = 0, into = 0, outOf = 0;
    for (const e of g.edges) { if (e.to === n.id) into++; if (e.from === n.id) outOf++; }
    side = Math.max(into, outOf);
    laid.set(n.id, { ...ll, w, h: Math.max(18 + ll.lines.length * 16, 12 + 6 * Math.max(0, side - 1)) });
  }
  const dir = !narrow && (g.direction === 'LR' || g.direction === 'RL') ? 'RIGHT' : 'DOWN';
  const edges = g.edges.filter(e => g.nodes.has(e.from) && g.nodes.has(e.to) && e.from !== e.to).map((e, i) => ({ e, id: `e${i}` }));
  const input: ElkGraphIn = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': dir, 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': dir === 'DOWN' ? '40' : '56', 'elk.spacing.nodeNode': dir === 'DOWN' ? '22' : '16',
      'elk.spacing.edgeNode': '18', 'elk.spacing.edgeEdge': '10', 'elk.layered.spacing.edgeNodeBetweenLayers': '24', 'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
      'elk.spacing.edgeLabel': '4', 'elk.edgeLabels.placement': 'CENTER',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.mergeEdges': 'false', 'elk.padding': `[top=${M},left=${M},bottom=${M},right=${M}]`,
    },
    children: Array.from(laid, ([id, l]) => ({ id, width: l.w, height: l.h })),
    edges: edges.map(({ e, id }) => ({ id, sources: [e.from], targets: [e.to], labels: e.label ? [{ text: e.label, width: Math.ceil(measureText(e.label.replace(/\n/g, ' '), 10.5, 600, t.font)) + 12, height: 18 }] : undefined })),
  };
  const out = await elk.layout(input);
  const W = Math.ceil(out.width || 0) + 2, H = Math.ceil(out.height || 0) + 2;
  let s = '';
  const byId = new Map(edges.map(x => [x.id, x.e] as const));
  const boxes = new Map((out.children || []).map(c => [c.id, { x: c.x || 0, y: c.y || 0, w: c.width || 0, h: c.height || 0 }] as const));
  // v3.92.3: ELK 는 한 노드로 들어오는 선을 같은 점에 붙이는 일이 있다. 끝점이 겹치면 진입 방향과 직각으로 9px 씩 벌린다
  const laidEdges: Array<{ e: FlowEdge; pts: Array<[number, number]> }> = [];
  for (const oe of out.edges || []) {
    const e = byId.get(oe.id); const sec = oe.sections?.[0]; if (!e || !sec) continue;
    let pts: Array<[number, number]> = [[sec.startPoint.x, sec.startPoint.y], ...(sec.bendPoints || []).map(p => [p.x, p.y] as [number, number]), [sec.endPoint.x, sec.endPoint.y]];
    const sb = boxes.get(e.from), tb = boxes.get(e.to);
    if (sb && g.nodes.get(e.from)?.shape === 'decision') pts = toDiamondVertex(pts, sb, false);
    if (tb && g.nodes.get(e.to)?.shape === 'decision') pts = toDiamondVertex(pts, tb, true);
    laidEdges.push({ e, pts });
  }
  {
    const spread = (keyOf: (pts: Array<[number, number]>) => string, at: 'start' | 'end') => {
      const by = new Map<string, number[]>();
      laidEdges.forEach((le, k) => { const key = keyOf(le.pts); if (!by.has(key)) by.set(key, []); by.get(key)!.push(k); });
      for (const list of by.values()) {
        if (list.length < 2) continue;
        list.forEach((k, j) => {
          const pts = laidEdges[k].pts; const n = pts.length;
          const i0 = at === 'end' ? n - 1 : 0, i1 = at === 'end' ? n - 2 : 1;
          const [qx, qy] = pts[i0], [px, py] = pts[i1];
          const d = (j - (list.length - 1) / 2) * 9;
          const vertical = Math.abs(qy - py) >= Math.abs(qx - px);
          if (vertical) { pts[i0] = [qx + d, qy]; pts[i1] = [px + d, py]; }
          else { pts[i0] = [qx, qy + d]; pts[i1] = [px, py + d]; }
        });
      }
    };
    // 끝점(들어오는 선)과 시작점(나가는 선) 둘 다 — 한 점에 몰리면 9px 씩 벌린다
    spread(pts => { const q = pts[pts.length - 1]; return `${Math.round(q[0] / 2)},${Math.round(q[1] / 2)}`; }, 'end');
    spread(pts => { const q = pts[0]; return `${Math.round(q[0] / 2)},${Math.round(q[1] / 2)}`; }, 'start');
  }
  for (const { e, pts } of laidEdges) {
    // 화살촉이 노드 테두리에 겹치지 않게 마지막 구간을 3px 줄인다
    const n = pts.length; const [px, py] = pts[n - 2], [qx, qy] = pts[n - 1]; const len = Math.hypot(qx - px, qy - py) || 1;
    pts[n - 1] = [qx - (qx - px) / len * 3, qy - (qy - py) / len * 3];
    const kind: StrokeKind = e.dashed ? 'ref' : e.thick ? 'axis' : 'flow';
    s += pathEl(opts?.curve ? basisPath(pts) : ortho(pts, 6), kind, t, uid, { noArrow: e.open, startArrow: e.bidir, edge: [e.from, e.to] });
  }
  // 엣지 라벨(ELK 가 계산한 자리)
  for (const oe of out.edges || []) {
    const e = byId.get(oe.id); const lb = oe.labels?.[0];
    if (e && lb && e.label) {
      const lw = lb.width || 0, lx = lb.x || 0, ly = lb.y || 0;
      s += svgEl('rect', { x: lx, y: ly, width: lw, height: 18, rx: 4, fill: t.surface, stroke: t.green, 'stroke-width': 1 });
      s += svgText(lx + 6, ly + 13, e.label.replace(/\n/g, ' '), { size: 10.5, weight: 600, fill: t.green }, t);
    }
  }
  for (const c of out.children || []) {
    const l = laid.get(c.id); const nd = g.nodes.get(c.id); if (!l || !nd) continue;
    const x = c.x || 0, y = c.y || 0, w = c.width || l.w, h = c.height || l.h;
    s += nodeBox(x, y, w, h, nd.shape, t, c.id);
    s += drawLines(x + w / 2, y + (h - l.lines.length * 16) / 2, l.lines, l.head, SZ, 600, 'middle', t, l.sys);
  }
  return svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + s);
}

// ────────────────────────────────────────────────────────────────────────────

/** 그래프를 섬 SVG 문자열로. width = 컨테이너 내부 폭(px). 지도는 폭과 무관하게 1:1 로 그려 가로 스크롤. */
export function renderFlowIsland(g: FlowGraph, kind: FlowIslandKind, width: number, extra?: CauseExtra): string {
  const t = resolveIslandTokens();
  if (kind === 'rail') return drawRail(buildRail(g), width, t);
  if (kind === 'branch') return drawBranch(g, width, t);
  if (kind === 'cause') return drawCause(g, width, t, extra);
  if (kind === 'graph') return drawMap(g, t, { lanes: buildRanks(g), onePerCol: true });
  return drawMap(g, t);
}

export const FLOW_KIND_LABEL: Record<FlowIslandKind, string> = { rail: '단계 궤도', branch: '분기 궤도', cause: '원인·결과', map: '연계 지도', graph: '관계 그래프' };

