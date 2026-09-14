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
import type { FlowGraph, FlowEdge } from './mermaidFlowParser';
import { resolveIslandTokens, measureText, wrapBalanced, svgEl, svgText } from './islandTokens';
import type { IslandTokens } from './islandTokens';

export type FlowIslandKind = 'rail' | 'branch' | 'cause' | 'map';

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

function pathEl(d: string, kind: StrokeKind, t: IslandTokens, uid: string, opts?: { noArrow?: boolean; startArrow?: boolean }): string {
  const s = strokeSpec(kind, t);
  return svgEl('path', {
    d, fill: 'none', stroke: s.stroke, 'stroke-width': s.width, 'stroke-dasharray': s.dash, 'stroke-opacity': s.opacity, 'stroke-linecap': 'round',
    'marker-end': opts?.noArrow ? undefined : `url(#${uid}-ar-${s.marker})`,
    'marker-start': opts?.startArrow ? `url(#${uid}-ar-${s.marker})` : undefined,
  });
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
  let best: string[] = [];
  const visit = (id: string, path: string[], seen: Set<string>) => {
    if (path.length > best.length) best = path.slice();
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

export function classifyFlow(g: FlowGraph): FlowIslandKind | null {
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
  const path = longestPath(g, ds);
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
  const hasLoop = g.edges.some(e => !e.dashed && onPath.has(e.from) && onPath.has(e.to) && path.indexOf(e.to) < path.indexOf(e.from));
  if (plainRail && !hasChain && !hasDecision && !hasLoop) return 'rail';
  return 'branch';
}

// ────────────────────────────────────────────────────────────────────────────
// rail
// ────────────────────────────────────────────────────────────────────────────

interface BranchItem { tag: string; label: string; kind: 'ok' | 'no' | 'alt' | 'in'; back?: string }
interface RailStep { label: string; branch?: BranchItem[] }

function buildRail(g: FlowGraph): RailStep[] {
  const ds = degrees(g, false);
  const dAll = degrees(g, true);
  const path = longestPath(g, ds);
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
    const step: RailStep = { label: node.label };
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
  for (const s of steps) labelW = Math.max(labelW, measureText(s.label, SZ, 600, t.font));
  const nodeW = Math.min(220, Math.max(124, Math.ceil(labelW) + 2 * pad));
  const lines = steps.map(s => wrapBalanced(s.label, nodeW - 2 * pad, SZ, 600, t.font));
  const maxL = Math.max(...lines.map(l => l.length));
  const nodeH = 18 + maxL * 16;
  const gapX = 44, gapY = hasBack ? 58 : 44, mL = hasBack ? 36 : 12, mT = hasBack ? 34 : 14, mR = hasBack ? 36 : 24;
  const cols = Math.max(1, Math.floor((W - mL - mR + gapX) / (nodeW + gapX)));
  const n = steps.length, rows = Math.ceil(n / cols);
  const extra: number[] = [];
  steps.forEach((s, i) => { const r = Math.floor(i / cols); const h = s.branch ? 14 + s.branch.length * 22 : 0; extra[r] = Math.max(extra[r] || 0, h); });
  const y0: number[] = []; let yc = mT;
  for (let r = 0; r < rows; r++) { y0[r] = yc; yc += nodeH + extra[r] + (r < rows - 1 ? gapY : 0); }
  const H = yc + 10;
  const pos = steps.map((_s, i) => { const r = Math.floor(i / cols); let c = i % cols; if (r % 2 === 1) c = cols - 1 - c; return { x: mL + c * (nodeW + gapX), y: y0[r], r }; });
  const usedW = Math.min(n, cols) * (nodeW + gapX) - gapX + mL + mR;
  let s = '';
  for (let i = 0; i < n - 1; i++) {
    const a = pos[i], b = pos[i + 1], am = a.y + nodeH / 2, bm = b.y + nodeH / 2;
    if (a.r === b.r) {
      const dir = b.x > a.x ? 1 : -1;
      const x1 = dir > 0 ? a.x + nodeW : a.x, x2 = dir > 0 ? b.x : b.x + nodeW;
      s += pathEl(`M${x1 + dir} ${am} L${x2 - dir * 3} ${am}`, 'flow', t, uid);
    } else {
      const right = cols === 1 || a.r % 2 === 0;
      const ex = right ? a.x + nodeW : a.x, hx = right ? ex + 18 : ex - 18, tx = right ? b.x + nodeW + 3 : b.x - 3;
      s += pathEl(`M${ex + (right ? 1 : -1)} ${am} H${hx} V${bm} H${tx}`, 'flow', t, uid);
    }
  }
  steps.forEach((st, i) => {
    const p = pos[i];
    s += svgEl('rect', { x: p.x, y: p.y, width: nodeW, height: nodeH, rx: 6, fill: t.surface, stroke: t.borderStrong, 'stroke-width': 1 });
    const blockH = lines[i].length * 16, top = p.y + (nodeH - blockH) / 2;
    lines[i].forEach((ln, k) => { s += svgText(p.x + nodeW / 2, top + 13 + k * 16, ln, { size: SZ, weight: 600, fill: t.text, anchor: 'middle' }, t); });
    if (st.branch) {
      const bx = p.x + 18, by = p.y + nodeH;
      st.branch.forEach((b, k) => {
        const yy = by + 18 + k * 22;
        s += svgEl('path', { d: `M${bx} ${by} V${yy} H${bx + 12}`, fill: 'none', stroke: t.border, 'stroke-width': 1.2 });
        const col = b.kind === 'no' ? t.red : b.kind === 'ok' ? t.green : b.kind === 'in' ? t.blue : t.text2;
        let x = bx + 14;
        if (b.tag) {
          const lw = measureText(b.tag, 10.5, 600, t.font) + 12;
          s += svgEl('rect', { x, y: yy - 9, width: lw, height: 18, rx: 4, fill: t.surface, stroke: col, 'stroke-width': 1 });
          s += svgText(x + 6, yy + 4, b.tag, { size: 10.5, weight: 600, fill: col }, t);
          x += lw + 8;
        }
        s += svgText(x, yy + 4, b.kind === 'in' ? `${b.label} →` : b.label, { size: 12, fill: t.text2 }, t);
        if (b.back) {
          const lx = p.x - 16, topY = p.y - 14, inX = p.x + Math.round(nodeW * 0.4);
          s += pathEl(`M${bx + 14} ${yy} H${lx} V${topY} H${inX} V${p.y - 3}`, 'back', t, uid);
          s += svgText(lx + 6, topY - 5, b.back, { size: 10, fill: t.text2 }, t);
        }
      });
    }
  });
  const SW = Math.max(usedW, W);
  return svgEl('svg', { width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + s);
}

// ────────────────────────────────────────────────────────────────────────────
// branch (세로 본선 + 오른쪽 가지 + 합류/되돌림)
// ────────────────────────────────────────────────────────────────────────────

interface Chain { tag: string; nodes: string[]; rejoin: number | null; dashed: boolean }
interface TrunkStep { id: string; tag?: string; chains: Chain[]; loops: Array<{ to: number; label: string }>; joins: Array<{ label: string; tag: string }>; leaves: BranchItem[] }

function buildBranch(g: FlowGraph): TrunkStep[] {
  const ds = degrees(g, false), dAll = degrees(g, true);
  const path = longestPath(g, ds);
  const idx = new Map<string, number>(); path.forEach((id, i) => idx.set(id, i));
  const used = new Set<string>(path);
  const steps: TrunkStep[] = path.map(id => ({ id, chains: [], loops: [], joins: [], leaves: [] }));
  path.forEach((id, i) => {
    const st = steps[i];
    for (const e of dAll.out.get(id) || []) {
      const ti = idx.get(e.to);
      if (ti !== undefined) {
        if (ti === i + 1 && !e.dashed) { if (e.label) st.tag = e.label; continue; }
        if (ti <= i) { st.loops.push({ to: ti, label: e.label || '' }); continue; }
        continue; // 앞으로 건너뛰는 경로 내 엣지는 생략(본선 화살표가 대신한다)
      }
      // 가지 따라가기
      const nodes: string[] = []; let cur = e.to; let rejoin: number | null = null; let guard = 0;
      while (cur && !idx.has(cur) && guard++ < 32) {
        if (used.has(cur)) break;
        nodes.push(cur); used.add(cur);
        const nx = (ds.out.get(cur) || [])[0];
        if (!nx) break;
        if (idx.has(nx.to)) { rejoin = idx.get(nx.to)!; break; }
        cur = nx.to;
      }
      if (nodes.length === 0) continue;
      const single = nodes.length === 1 && rejoin === null && (dAll.outdeg.get(nodes[0]) || 0) === 0;
      if (single && !e.dashed && !g.nodes.get(nodes[0])!.shape) {
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

/** 좁은 폭(폰) 분기 궤도: 가지를 오른쪽이 아니라 본선 아래에 들여쓴 세로 목록으로 놓는다.
 *  가로 스크롤 없이 한 열로 읽히고, 본선 연결선은 왼쪽 가장자리로 우회해 가지를 가로지르지 않는다. */
function drawBranchNarrow(g: FlowGraph, width: number, t: IslandTokens): string {
  const uid = nextUid();
  const steps = buildBranch(g);
  const SZ = 12.5, pad = 12, W = Math.max(280, width);
  const hasLoop = steps.some(s => s.loops.length);
  const mL = hasLoop ? 34 : 10, mR = 10, mT = 12, gapY = 26, indent = 26, chainGap = 10;
  const labelOf = (id: string) => g.nodes.get(id)!.label;
  const nodeW = W - mL - mR;
  const chainW = nodeW - indent;
  const nodeH = (lines: number) => 18 + lines * 16;
  type Placed = { id: string; x: number; y: number; w: number; h: number; lines: string[]; decision: boolean };
  const trunk: Placed[] = []; const extras: Placed[] = []; let svg = ''; let y = mT;
  const chainCols: Array<{ step: number; chain: Chain; placed: Placed[] }> = [];
  const itemY: number[] = [];
  steps.forEach((st) => {
    const lines = wrapBalanced(labelOf(st.id), nodeW - 2 * pad, SZ, 600, t.font); const h = nodeH(lines.length);
    const p: Placed = { id: st.id, x: mL, y, w: nodeW, h, lines, decision: g.nodes.get(st.id)!.shape === 'decision' };
    trunk.push(p);
    y += h;
    // 잎·입력 항목은 노드 바로 아래
    const itemRows = st.leaves.length + st.joins.length;
    itemY.push(y + 16);
    if (itemRows) y += 8 + itemRows * 20;
    // 가지: 들여쓴 세로 목록 (태그 줄 + 노드들)
    st.chains.forEach((ch) => {
      y += 22 + (ch.tag ? 16 : 0);
      const placed: Placed[] = [];
      for (const id of ch.nodes) {
        const ls = wrapBalanced(labelOf(id), chainW - 2 * pad, SZ, 500, t.font); const hh = nodeH(ls.length);
        placed.push({ id, x: mL + indent, y, w: chainW, h: hh, lines: ls, decision: g.nodes.get(id)!.shape === 'decision' });
        y += hh + chainGap + 14;
      }
      y -= chainGap + 14;
      chainCols.push({ step: trunk.length - 1, chain: ch, placed });
      extras.push(...placed);
    });
    y += gapY;
  });
  const H = y - gapY + 12;
  // 본선 연결선: 가지가 끼면 왼쪽 가장자리로 우회
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i], b = trunk[i + 1];
    const busy = steps[i].chains.length > 0;
    if (busy) { const lx = mL + 10; svg += pathEl(`M${lx} ${a.y + a.h + 1} L${lx} ${b.y - 3}`, 'flow', t, uid); if (steps[i].tag) svg += svgText(lx + 8, b.y - 7, steps[i].tag!, { size: 10.5, weight: 600, fill: t.green }, t); }
    else { const xm = a.x + a.w / 2; svg += pathEl(`M${xm} ${a.y + a.h + 1} L${xm} ${b.y - 3}`, 'flow', t, uid); if (steps[i].tag) svg += svgText(xm + 8, b.y - 7, steps[i].tag!, { size: 10.5, weight: 600, fill: t.green }, t); }
  }
  // 가지 연결선
  for (const col of chainCols) {
    const from = trunk[col.step]; const first = col.placed[0]; const last = col.placed[col.placed.length - 1];
    const kind: StrokeKind = col.chain.dashed ? 'ref' : 'flow';
    const cx = first.x + Math.min(40, first.w / 2);
    svg += pathEl(`M${cx} ${from.y + from.h + 1} L${cx} ${first.y - 3}`, kind, t, uid);
    if (col.chain.tag) {
      const lw = measureText(col.chain.tag, 10.5, 600, t.font) + 12; const ty = first.y - 22;
      svg += svgEl('rect', { x: cx + 8, y: ty, width: lw, height: 18, rx: 4, fill: t.surface, stroke: t.green, 'stroke-width': 1 });
      svg += svgText(cx + 14, ty + 13, col.chain.tag, { size: 10.5, weight: 600, fill: t.green }, t);
    }
    for (let k = 0; k < col.placed.length - 1; k++) { const p = col.placed[k], q = col.placed[k + 1]; const xx = p.x + Math.min(40, p.w / 2); svg += pathEl(`M${xx} ${p.y + p.h + 1} L${xx} ${q.y - 3}`, 'flow', t, uid); }
    if (col.chain.rejoin !== null) {
      const rj = trunk[col.chain.rejoin]; const lx = last.x + Math.min(40, last.w / 2);
      if (rj === trunk[col.step + 1] || rj.y > last.y) {
        // 합류점이 바로 아래면 세로로, 더 아래면 오른쪽 가장자리로 우회
        if (rj === trunk[col.step + 1]) svg += pathEl(`M${lx} ${last.y + last.h + 1} L${lx} ${rj.y - 3}`, kind, t, uid);
        else { const rx = mL + nodeW + 4; svg += pathEl(`M${last.x + last.w + 1} ${last.y + last.h / 2} H${rx} V${rj.y + rj.h / 2} L${rj.x + rj.w + 3} ${rj.y + rj.h / 2}`, kind, t, uid); }
      }
    }
  }
  // 되돌림(왼쪽 고리)
  steps.forEach((st, i) => {
    st.loops.forEach((lp, k) => {
      const a = trunk[i], b = trunk[lp.to]; const lx = mL - 12 - k * 6;
      svg += pathEl(`M${a.x - 1} ${a.y + a.h / 2} H${lx} V${b.y + b.h / 2} L${b.x - 3} ${b.y + b.h / 2}`, 'back', t, uid);
      if (lp.label) svg += svgText(lx - 3, (a.y + b.y + b.h) / 2, lp.label, { size: 10, fill: t.text2, anchor: 'end' }, t);
    });
  });
  const drawNode = (p: Placed, weight: number) => {
    if (p.decision) svg += svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.h / 2, fill: t.surface, stroke: t.primary, 'stroke-width': 1.5 });
    else svg += svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: 6, fill: t.surface, stroke: t.borderStrong, 'stroke-width': 1 });
    const top = p.y + (p.h - p.lines.length * 16) / 2;
    p.lines.forEach((ln, k) => { svg += svgText(p.x + p.w / 2, top + 13 + k * 16, ln, { size: SZ, weight, fill: t.text, anchor: 'middle' }, t); });
  };
  trunk.forEach(p => drawNode(p, 600)); extras.forEach(p => drawNode(p, 500));
  // 잎·입력 항목
  steps.forEach((st, i) => {
    const p = trunk[i]; let yy = itemY[i];
    const items = [...st.joins.map(j => ({ tag: j.tag, label: `${j.label} →`, col: t.blue })), ...st.leaves.map(l => ({ tag: l.tag, label: l.label, col: t.text2 }))];
    for (const it of items) {
      const bx = p.x + 18;
      svg += svgEl('path', { d: `M${bx} ${p.y + p.h} V${yy} H${bx + 12}`, fill: 'none', stroke: t.border, 'stroke-width': 1.2 });
      let x = bx + 14;
      if (it.tag) { const lw = measureText(it.tag, 10.5, 600, t.font) + 12; svg += svgEl('rect', { x, y: yy - 9, width: lw, height: 18, rx: 4, fill: t.surface, stroke: it.col, 'stroke-width': 1 }); svg += svgText(x + 6, yy + 4, it.tag, { size: 10.5, weight: 600, fill: it.col }, t); x += lw + 8; }
      svg += svgText(x, yy + 4, it.label, { size: 12, fill: t.text2 }, t);
      yy += 20;
    }
  });
  return svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + svg);
}

function drawBranch(g: FlowGraph, width: number, t: IslandTokens): string {
  if (width < 520) return drawBranchNarrow(g, width, t);
  const uid = nextUid();
  const steps = buildBranch(g);
  const SZ = 12.5, pad = 12, W = Math.max(300, width);
  const hasLoop = steps.some(s => s.loops.length);
  const mL = hasLoop ? 40 : 12, mT = 12, gapY = 30, gapX = 30, rowGap = 12;
  const labelOf = (id: string) => g.nodes.get(id)!.label;
  // 본선 노드 폭: 라벨 최대 폭에 맞추되 220 을 넘기지 않는다
  let tw = 0; for (const s of steps) tw = Math.max(tw, measureText(labelOf(s.id), SZ, 600, t.font));
  const nodeW = Math.min(220, Math.max(150, Math.ceil(tw) + 2 * pad));
  const wrapN = (id: string, w: number) => wrapBalanced(labelOf(id), w - 2 * pad, SZ, 600, t.font);
  const chainNodeW = (id: string) => Math.min(200, Math.max(110, Math.ceil(measureText(labelOf(id), SZ, 500, t.font)) + 2 * pad));
  const nodeH = (lines: number) => 18 + lines * 16;
  // 세로 배치
  type Placed = { id: string; x: number; y: number; w: number; h: number; lines: string[]; decision: boolean };
  const trunk: Placed[] = []; const extras: Placed[] = []; let svg = ''; let y = mT; let maxX = mL + nodeW;
  const chainRows: Array<{ step: number; chain: Chain; y: number; placed: Placed[] }> = [];
  steps.forEach((st) => {
    const lines = wrapN(st.id, nodeW); const h = nodeH(lines.length);
    const p: Placed = { id: st.id, x: mL, y, w: nodeW, h, lines, decision: g.nodes.get(st.id)!.shape === 'decision' };
    trunk.push(p);
    // 가지 행: 첫 가지는 노드와 같은 높이, 다음 가지는 아래 행
    let rowY = y;
    st.chains.forEach((ch, k) => {
      if (k > 0) rowY += rowGap + 40;
      const tagW = ch.tag ? measureText(ch.tag, 10.5, 600, t.font) + 12 + 8 : 0;
      let x = mL + nodeW + gapX + (k > 0 ? 18 : 0) + tagW; // 태그 자리
      const placed: Placed[] = [];
      for (const id of ch.nodes) {
        const w = chainNodeW(id); const ls = wrapBalanced(labelOf(id), w - 2 * pad, SZ, 500, t.font); const hh = nodeH(ls.length);
        placed.push({ id, x, y: rowY + (h - hh) / 2, w, h: hh, lines: ls, decision: g.nodes.get(id)!.shape === 'decision' });
        x += w + gapX;
      }
      maxX = Math.max(maxX, x - gapX + 20);
      chainRows.push({ step: trunk.length - 1, chain: ch, y: rowY, placed });
      extras.push(...placed);
    });
    // 잎·입력 항목(노드 아래 작은 줄)
    const itemRows = st.leaves.length + st.joins.length;
    const bottom = Math.max(y + h, rowY + h) + (itemRows ? 8 + itemRows * 20 : 0);
    y = bottom + gapY;
  });
  const H = y - gapY + 12;
  // 본선 화살표 + 태그
  for (let i = 0; i < trunk.length - 1; i++) {
    const a = trunk[i], b = trunk[i + 1], xm = a.x + a.w / 2;
    svg += pathEl(`M${xm} ${a.y + a.h + 1} L${xm} ${b.y - 3}`, 'flow', t, uid);
    if (steps[i].tag) svg += svgText(xm + 8, b.y - 7, steps[i].tag!, { size: 10.5, weight: 600, fill: t.green }, t);
  }
  // 가지 연결선
  for (const row of chainRows) {
    const from = trunk[row.step]; const first = row.placed[0]; const last = row.placed[row.placed.length - 1];
    const kind: StrokeKind = row.chain.dashed ? 'ref' : 'flow';
    const sameRow = Math.abs(row.y - from.y) < 1;
    const ym = first.y + first.h / 2;
    if (sameRow) svg += pathEl(`M${from.x + from.w + 1} ${ym} L${first.x - 3} ${ym}`, kind, t, uid);
    else { const bx = from.x + from.w + 14; svg += pathEl(`M${from.x + from.w + 1} ${from.y + from.h / 2} H${bx} V${ym} L${first.x - 3} ${ym}`, kind, t, uid); }
    if (row.chain.tag) {
      const lw = measureText(row.chain.tag, 10.5, 600, t.font) + 12; const tx = first.x - 8 - lw, ty = ym - 9;
      svg += svgEl('rect', { x: tx, y: ty, width: lw, height: 18, rx: 4, fill: t.surface, stroke: t.green, 'stroke-width': 1 });
      svg += svgText(tx + 6, ym + 4, row.chain.tag, { size: 10.5, weight: 600, fill: t.green }, t);
    }
    for (let k = 0; k < row.placed.length - 1; k++) { const p = row.placed[k], q = row.placed[k + 1]; const yy = p.y + p.h / 2; svg += pathEl(`M${p.x + p.w + 1} ${yy} L${q.x - 3} ${yy}`, 'flow', t, uid); }
    if (row.chain.rejoin !== null) {
      const rj = trunk[row.chain.rejoin]; const rx = last.x + last.w + 14; const ry = rj.y + rj.h / 2;
      const lastY = last.y + last.h / 2;
      if (rj.y > last.y) svg += pathEl(`M${last.x + last.w + 1} ${lastY} H${rx} V${ry} L${rj.x + rj.w + 3} ${ry}`, kind, t, uid);
      else svg += pathEl(`M${last.x + last.w + 1} ${lastY} H${rx} V${ry} L${rj.x + rj.w + 3} ${ry}`, kind, t, uid);
      maxX = Math.max(maxX, rx + 8);
    }
  }
  // 되돌림(왼쪽 고리)
  steps.forEach((st, i) => {
    st.loops.forEach((lp, k) => {
      const a = trunk[i], b = trunk[lp.to]; const lx = mL - 14 - k * 6;
      svg += pathEl(`M${a.x - 1} ${a.y + a.h / 2} H${lx} V${b.y + b.h / 2} L${b.x - 3} ${b.y + b.h / 2}`, 'back', t, uid);
      if (lp.label) svg += svgText(lx - 3, (a.y + b.y + b.h) / 2, lp.label, { size: 10, fill: t.text2, anchor: 'end' }, t);
    });
  });
  // 노드
  const drawNode = (p: Placed, weight: number) => {
    if (p.decision) {
      svg += svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.h / 2, fill: t.surface, stroke: t.primary, 'stroke-width': 1.5 });
    } else svg += svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: 6, fill: t.surface, stroke: t.borderStrong, 'stroke-width': 1 });
    const top = p.y + (p.h - p.lines.length * 16) / 2;
    p.lines.forEach((ln, k) => { svg += svgText(p.x + p.w / 2, top + 13 + k * 16, ln, { size: SZ, weight, fill: t.text, anchor: 'middle' }, t); });
  };
  trunk.forEach(p => drawNode(p, 600)); extras.forEach(p => drawNode(p, 500));
  // 잎·입력 항목
  steps.forEach((st, i) => {
    const p = trunk[i]; let yy = Math.max(p.y + p.h, ...st.chains.map((_c, k) => p.y + p.h + k * (rowGap + 40))) + 16;
    const items = [...st.joins.map(j => ({ tag: j.tag, label: `${j.label} →`, col: t.blue })), ...st.leaves.map(l => ({ tag: l.tag, label: l.label, col: t.text2 }))];
    for (const it of items) {
      const bx = p.x + 18;
      svg += svgEl('path', { d: `M${bx} ${p.y + p.h} V${yy} H${bx + 12}`, fill: 'none', stroke: t.border, 'stroke-width': 1.2 });
      let x = bx + 14;
      if (it.tag) { const lw = measureText(it.tag, 10.5, 600, t.font) + 12; svg += svgEl('rect', { x, y: yy - 9, width: lw, height: 18, rx: 4, fill: t.surface, stroke: it.col, 'stroke-width': 1 }); svg += svgText(x + 6, yy + 4, it.tag, { size: 10.5, weight: 600, fill: it.col }, t); x += lw + 8; }
      svg += svgText(x, yy + 4, it.label, { size: 12, fill: t.text2 }, t);
      yy += 20;
    }
  });
  const SW = Math.max(maxX + 12, Math.min(W, maxX + 12));
  return svgEl('svg', { width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + svg);
}

// ────────────────────────────────────────────────────────────────────────────
// cause (뿌리 → 원인 → 결과)
// ────────────────────────────────────────────────────────────────────────────

function drawCause(g: FlowGraph, width: number, t: IslandTokens): string {
  const uid = nextUid();
  const d = degrees(g, true);
  const root = Array.from(g.nodes.keys()).find(id => (d.indeg.get(id) || 0) === 0)!;
  const rows = (d.out.get(root) || []).map(e => {
    const cause = g.nodes.get(e.to)!;
    const eff = (d.out.get(e.to) || [])[0];
    return { cause: cause.label, effect: eff ? g.nodes.get(eff.to)!.label : '', strong: e.thick || eff?.thick === true, dashed: e.dashed };
  });
  const W = Math.max(320, width), gap = Math.min(110, Math.max(64, W * 0.15)), colW = (W - gap - 16) / 2, pad = 12, SZ = 12.5;
  const laid = rows.map(r => {
    const cl = wrapBalanced(r.cause, colW - 2 * pad, SZ, 600, t.font), el = wrapBalanced(r.effect || '', colW - 2 * pad, SZ, 600, t.font);
    return { ...r, cl, el, h: Math.max(cl.length, el.length) * 16 + 20 };
  });
  let y = 12, s = '';
  const rootLabel = g.nodes.get(root)!.label;
  s += svgText(8, y, rootLabel, { size: 11, weight: 600, fill: t.text2 }, t);
  s += svgText(8 + colW + gap, y, '결과', { size: 11, weight: 600, fill: t.text2 }, t);
  y += 12;
  for (const rw of laid) {
    const x1 = 8, x2 = 8 + colW + gap;
    s += svgEl('rect', { x: x1, y, width: colW, height: rw.h, rx: 6, fill: t.surface, stroke: rw.strong ? t.text : t.borderStrong, 'stroke-width': rw.strong ? 1.4 : 1 });
    rw.cl.forEach((ln, k) => { s += svgText(x1 + colW / 2, y + 18 + k * 16, ln, { size: SZ, weight: 600, fill: t.text, anchor: 'middle' }, t); });
    if (rw.effect) {
      s += svgEl('rect', { x: x2, y, width: colW, height: rw.h, rx: 6, fill: t.surface, stroke: t.border, 'stroke-width': 1 });
      rw.el.forEach((ln, k) => { s += svgText(x2 + colW / 2, y + 18 + k * 16, ln, { size: SZ, weight: 600, fill: t.text, anchor: 'middle' }, t); });
      const ym = y + rw.h / 2;
      s += pathEl(`M${x1 + colW + 2} ${ym} L${x2 - 4} ${ym}`, rw.strong ? 'no' : rw.dashed ? 'ref' : 'soft', t, uid);
    }
    y += rw.h + 10;
  }
  return svgEl('svg', { width: W, height: y + 2, viewBox: `0 0 ${W} ${y + 2}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + s);
}

// ────────────────────────────────────────────────────────────────────────────
// map (subgraph 레인 + 직각 라우팅 + 분리 진입)
// ────────────────────────────────────────────────────────────────────────────

interface MapNode { id: string; label: string; x: number; y: number; w: number; h: number; col: number; lane: string; idx: number; hub: boolean; L: PortRef[]; R: PortRef[] }
interface MapEdge { from: string; to: string; kind: StrokeKind; bi: boolean; a: MapNode; b: MapNode; type: 'fwd' | 'long' | 'back' | 'adj' | 'side'; side?: 'L' | 'R'; ay?: number; by?: number; slotX?: number }
interface PortRef { e: MapEdge; other: MapNode }

function drawMap(g: FlowGraph, t: IslandTokens): string {
  const uid = nextUid();
  const SZ = 12, rowGap = 6, baseH = 26, laneGap = 26, colGap = 100, mL = 48, mR = 16, mT = 10, pad = 10, SLOT = 6, PORT = 6;
  // 레인 → 열 배치: 4열까지는 하나씩, 그 이상은 앞 둘은 단독·나머지는 둘씩 쌓기
  const lanes = g.subgraphs.filter(sg => sg.nodes.length > 0);
  const columns: typeof lanes[] = [];
  if (lanes.length <= 4) lanes.forEach(l => columns.push([l]));
  else { columns.push([lanes[0]], [lanes[1]]); for (let i = 2; i < lanes.length; i += 2) columns.push(lanes.slice(i, i + 2)); }
  // 허브: 차수 상위 2개(차수 5 이상)
  const deg = new Map<string, number>();
  for (const e of g.edges) { deg.set(e.from, (deg.get(e.from) || 0) + 1); deg.set(e.to, (deg.get(e.to) || 0) + 1); }
  const hubs = new Set(Array.from(deg.entries()).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k));

  const nodes = new Map<string, MapNode>(); const all: MapNode[] = [];
  const colW: number[] = [], colX: number[] = []; let cx = mL;
  columns.forEach((col, ci) => {
    let w = 0;
    col.forEach(ln => { ln.nodes.forEach(id => { const nd = g.nodes.get(id)!; w = Math.max(w, measureText(nd.label, SZ, hubs.has(id) ? 700 : 500, t.font)); }); w = Math.max(w, measureText(ln.title, 11, 600, t.font) - 10); });
    colW[ci] = Math.ceil(w) + 2 * pad; colX[ci] = cx; cx += colW[ci] + colGap;
    col.forEach(ln => ln.nodes.forEach((id, ni) => {
      const nd = g.nodes.get(id)!;
      const o: MapNode = { id, label: nd.label, x: colX[ci], y: 0, w: colW[ci], h: baseH, col: ci, lane: ln.id, idx: ni, hub: hubs.has(id), L: [], R: [] };
      nodes.set(id, o); all.push(o);
    }));
  });
  const totalW = cx - colGap + mR, ncol = columns.length;
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
    const me: MapEdge = { from: e.from, to: e.to, kind, bi: e.bidir, a, b, type: 'fwd' };
    if (b.col === a.col + 1) me.type = 'fwd'; else if (b.col > a.col + 1) me.type = 'long'; else if (b.col < a.col) me.type = 'back';
    else if (a.lane === b.lane && Math.abs(a.idx - b.idx) === 1) me.type = 'adj'; else me.type = 'side';
    if (me.type === 'fwd' || me.type === 'long') { a.R.push({ e: me, other: b }); b.L.push({ e: me, other: a }); }
    else if (me.type === 'back') { b.L.push({ e: me, other: a }); }
    else if (me.type === 'side') { me.side = a.col === 0 ? 'L' : 'R'; const la = me.side === 'R' ? a.R : a.L, lb = me.side === 'R' ? b.R : b.L; la.push({ e: me, other: b }); lb.push({ e: me, other: a }); }
    edges.push(me);
  }
  // 노드 높이(포트 수) + 세로 배치
  for (const nd of all) { const np = Math.max(nd.L.length, nd.R.length); nd.h = Math.max(baseH, 12 + PORT * (np - 1)); }
  let maxY = 0, laneS = '';
  columns.forEach((col, ci) => {
    let y = mT;
    col.forEach(ln => {
      laneS += svgText(colX[ci], y + 11, ln.title, { size: 11, weight: 600, fill: t.text2 }, t); y += 22;
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
    let k = 0; list.forEach(e => { if (e.type === 'side') k = Math.max(k, 2); e.slotX = colX[c] + colW[c] + 10 + k * SLOT; k++; });
  });
  const leftSlots = edges.filter(e => e.type === 'side' && e.side === 'L');
  leftSlots.sort((p, q) => Math.abs(q.b.y - q.a.y) - Math.abs(p.b.y - p.a.y));
  leftSlots.forEach((e, i) => { e.slotX = colX[0] - 10 - (i + 2) * SLOT; });
  // 경로
  let chan = 0; const approach: number[] = []; for (let c = 0; c < ncol; c++) approach[c] = 0;
  let eS = '';
  for (const e of edges) {
    const a = e.a, b = e.b, ay = e.ay ?? a.y + a.h / 2, by = e.by ?? b.y + b.h / 2, sx = e.slotX ?? 0;
    let pts: Array<[number, number]>;
    if (e.type === 'fwd') pts = Math.abs(ay - by) < 2 ? [[a.x + a.w + 1, ay], [b.x - 3, by]] : [[a.x + a.w + 1, ay], [sx, ay], [sx, by], [b.x - 3, by]];
    else if (e.type === 'long') { const cy = maxY + 10 + (chan++) * 8, apx = b.x - 12 - (approach[b.col]++) * SLOT; pts = [[a.x + a.w + 1, ay], [sx, ay], [sx, cy], [apx, cy], [apx, by], [b.x - 3, by]]; }
    else if (e.type === 'back') { const cy = maxY + 10 + (chan++) * 8, lx = b.col === 0 ? 8 : b.x - 12 - (approach[b.col]++) * SLOT; pts = [[a.x + a.w / 2, a.y + a.h + 1], [a.x + a.w / 2, cy], [lx, cy], [lx, by], [b.x - 3, by]]; }
    else if (e.type === 'adj') { const xm = a.x + a.w / 2, down = b.idx > a.idx; pts = down ? [[xm, a.y + a.h + 1], [xm, b.y - 3]] : [[xm, a.y - 1], [xm, b.y + b.h + 3]]; }
    else pts = e.side === 'R' ? [[a.x + a.w + 1, ay], [sx, ay], [sx, by], [b.x + b.w + 3, by]] : [[a.x - 1, ay], [sx, ay], [sx, by], [b.x - 3, by]];
    eS += pathEl(ortho(pts, 8), e.kind, t, uid, { startArrow: e.bi });
  }
  let nodeS = '';
  for (const nd of all) {
    nodeS += svgEl('rect', { x: nd.x, y: nd.y, width: nd.w, height: nd.h, rx: 5, fill: nd.hub ? t.text : t.surface, stroke: nd.hub ? t.text : t.borderStrong, 'stroke-width': 1 });
    nodeS += svgText(nd.x + nd.w / 2, nd.y + nd.h / 2 + 4.2, nd.label, { size: SZ, weight: nd.hub ? 700 : 500, fill: nd.hub ? t.surface : t.text, anchor: 'middle' }, t);
  }
  const H = maxY + 10 + chan * 8 + 12;
  return svgEl('svg', { width: totalW, height: H, viewBox: `0 0 ${totalW} ${H}`, role: 'img', xmlns: 'http://www.w3.org/2000/svg' }, defs(t, uid) + eS + nodeS + laneS);
}

// ────────────────────────────────────────────────────────────────────────────

/** 그래프를 섬 SVG 문자열로. width = 컨테이너 내부 폭(px). 지도는 폭과 무관하게 1:1 로 그려 가로 스크롤. */
export function renderFlowIsland(g: FlowGraph, kind: FlowIslandKind, width: number): string {
  const t = resolveIslandTokens();
  if (kind === 'rail') return drawRail(buildRail(g), width, t);
  if (kind === 'branch') return drawBranch(g, width, t);
  if (kind === 'cause') return drawCause(g, width, t);
  return drawMap(g, t);
}

export const FLOW_KIND_LABEL: Record<FlowIslandKind, string> = { rail: '단계 궤도', branch: '분기 궤도', cause: '원인·결과', map: '연계 지도' };

