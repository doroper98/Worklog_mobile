/**
 * mermaidFlowParser — Mermaid flowchart/graph 소스를 섬이 쓰는 그래프(FlowGraph)로 읽는다.
 *
 * v3.87.0: 마크다운 섬 도입. LLM 이 이미 내는 ```mermaid 블록을 손대지 않고,
 *  렌더러가 파싱해 "섬"(글자 크기 고정 SVG)으로도, Mermaid 로도 그릴 수 있게 한다.
 *
 * v3.92.0: 두 경로.
 *  1) fromMermaidDb — Mermaid 라이브러리의 자체 파서가 만든 db(getVertices/getEdges/getSubGraphs)를
 *     FlowGraph 로 옮긴다. 앱 안에서 `mermaid.mermaidAPI.getDiagramFromText(src)` 를 호출해 얻는다
 *     (외부 전송 없음). Mermaid 가 그리는 것과 정확히 같은 노드·엣지·subgraph 를 얻으므로
 *     따옴표 라벨·여러 줄 라벨·`&`·중첩 subgraph·style 줄 등 문법 전부를 그대로 따른다.
 *  2) parseFlowchart — 동기 정규식 파서(부분집합). Mermaid 를 아직 못 불러온 첫 렌더와,
 *     Mermaid 가 파싱에 실패한 블록(예: 대괄호 안의 `(2)`)의 폴백. 실데이터 211개 flowchart
 *     전수 대조에서 db 경로와 같은 결과를 내도록 맞춘다(여러 줄 라벨·따옴표·`&`·`:::class`).
 *
 * 지원 범위 (정규식 파서):
 *  - `flowchart|graph LR|RL|TD|TB|BT`
 *  - 노드 `A[label]` `A["label"]` `A(label)` `A((label))` `A{label}` `A>label]` `A[/label/]` `A[(db)]` `A([stadium])` `A[[sub]]` `A{{hex}}`
 *    라벨 안 <br/> 과 줄 끝 `\` 는 줄바꿈으로 보존
 *  - 엣지 `-->` `---` `-.->` `-.-` `==>` `===` `<-->` `~~~`, 라벨 `-->|t|` `-- t -->` `-. t .->` `-.t.->` `== t ==>`
 *  - 한 줄 사슬 `A --> B --> C`, `A & B --> C`
 *  - `subgraph ID["title"]` … `end`  (중첩은 바깥 것만 레인, 안쪽 노드는 바깥에 합침)
 *  - `%%` 주석, classDef/class/style/linkStyle/click 은 무시
 * 그 밖의 다이어그램(sequence, gantt 등)은 null 을 돌려 Mermaid 렌더로 남긴다.
 */

export type FlowDirection = 'LR' | 'RL' | 'TD' | 'TB' | 'BT';

/** 노드 모양. decision = `{}` 마름모, cylinder = `[( )]` DB, circle = `(( ))`, stadium = `([ ])`/`( )`,
 *  subroutine = `[[ ]]`, hexagon = `{{ }}`. 나머지(사다리꼴·깃발 등)는 rect 로 그린다. */
export type FlowShape = 'decision' | 'cylinder' | 'circle' | 'stadium' | 'subroutine' | 'hexagon';

export interface FlowNode {
  id: string;
  label: string;
  subgraph?: string;
  order: number;
  shape?: FlowShape;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  thick: boolean;
  bidir: boolean;
  /** `---` `-.-` `===` 처럼 화살촉이 없는 선 */
  open?: boolean;
}

export interface FlowSubgraph {
  id: string;
  title: string;
  nodes: string[];
}

export interface FlowGraph {
  direction: FlowDirection;
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
}

const HEAD_RE = /^(?:flowchart|graph)\s+(LR|RL|TD|TB|BT)\b/;
const SKIP_RE = /^(?:classDef|class|style|linkStyle|click|direction)\b/;
/** 엣지 연산자 (라벨 정규화 후): 앞 `<`, 몸통, 뒤 `>`/`x`/`o`, 선택적 `|label|` */
const EDGE_SPLIT_RE = /\s*(<?(?:-{2,}|={2,}|-\.+-?|~{3,})(?:>|x|o)?)(?:\|([^|]*)\|)?\s*/g;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#34': '"' };
function decodeEntities(s: string): string {
  return s.replace(/&(#?\w+);/g, (m, k: string) => (k in ENTITIES ? ENTITIES[k] : m));
}

/** 라벨 정리: <br>·줄 끝 `\`·글자 그대로의 `\n` 은 줄바꿈으로 보존(제목 줄 + 설명 줄 구조가 흔하다), 엔티티 해제, 줄 안 공백 정리. */
export function cleanLabel(raw: string): string {
  return decodeEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\\r?\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/^"+|"+$/g, '')
    .replace(/^`+|`+$/g, '')
    .replace(/\*\*/g, '')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** `A["label"]` 류에서 id 와 label 을 분리. label 이 없으면 undefined. */
function parseNodeToken(token: string): { id: string; label?: string; shape?: FlowShape; hidden?: boolean } | null {
  const m = /^([A-Za-z0-9_][\w-]*)\s*([\s\S]*)$/.exec(token.trim().replace(/:::[\w-]+\s*$/, ''));
  if (!m) return null;
  const id = m[1];
  const rest = m[2].trim();
  if (!rest) return { id };
  let shape: FlowShape | undefined;
  if (rest.startsWith('{{')) shape = 'hexagon';
  else if (rest.startsWith('{')) shape = 'decision';
  else if (rest.startsWith('[(')) shape = 'cylinder';
  else if (rest.startsWith('[[')) shape = 'subroutine';
  else if (rest.startsWith('((')) shape = 'circle';
  else if (rest.startsWith('([') || rest.startsWith('(')) shape = 'stadium';
  // `A["[MDS]"<br/>설명]` 처럼 앞 토막만 따옴표로 묶은 꼴은 그 따옴표만 벗긴다
  const inner = rest.replace(/^[[({>/\\]+/, '').replace(/[\])}/\\]+$/, '').replace(/^"([^"]*)"(?=.)/, '$1');
  if (inner.replace(/"/g, '').trim() === '') return { id, hidden: true }; // `HSP1[ ]` 빈 칸 노드
  return { id, label: cleanLabel(inner), shape };
}

/** 대괄호·따옴표 밖의 `&` 에서만 나눈다 — `[R&R 정의]` 는 한 노드 */
function splitAmp(tok: string): string[] {
  const out: string[] = []; let depth = 0, q = false, cur = '';
  for (const c of tok) {
    if (c === '"') q = !q;
    else if (!q && '[({'.includes(c)) depth++;
    else if (!q && '])}'.includes(c)) depth = Math.max(0, depth - 1);
    if (c === '&' && !q && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}

/** 라벨을 몸통 안에 쓰는 형태(`-- t -->`, `-.t.->`, `== t ==>`)를 `-->|t|` 로 정규화 */
function normalizeInlineLabels(line: string): string {
  // 글은 따옴표 묶음이거나, 연산자 글자로 시작하지 않는 아무 글(안에 `-` 가 있어도 됨: "c-DN")
  const TXT = '("[^"]*"|[^\\s"\\-.=|<>][^|]*?)';
  return line
    .replace(new RegExp(`-\\.\\s*${TXT}\\s*\\.-(>|x|o)?`, 'g'), (_m, t: string, e?: string) => `-.-${e || ''}|${t.trim()}|`)
    .replace(new RegExp(`==\\s+${TXT}\\s+==(=|>|x|o)`, 'g'), (_m, t: string, e: string) => `==${e}|${t.trim()}|`)
    .replace(new RegExp(`--\\s+${TXT}\\s+--(-|>|x|o)`, 'g'), (_m, t: string, e: string) => `--${e}|${t.trim()}|`);
}

/** 따옴표나 대괄호가 닫히지 않은 줄은 다음 줄과 잇는다(여러 줄 라벨). 이은 자리는 `\n` 로 남겨 cleanLabel 이 줄바꿈으로 본다. */
function joinContinuations(lines: string[]): string[] {
  const out: string[] = [];
  let buf = '';
  const open = (s: string) => {
    let depth = 0, q = 0;
    for (const c of s) { if (c === '"') q++; else if (q % 2 === 0 && '[({'.includes(c)) depth++; else if (q % 2 === 0 && '])}'.includes(c)) depth--; }
    return q % 2 === 1 || depth > 0;
  };
  for (const raw of lines) {
    const l = raw.replace(/\s+$/, '');
    if (buf) { buf = buf.replace(/\\$/, '') + '\\n' + l.trim(); if (!open(buf)) { out.push(buf); buf = ''; } continue; }
    if (open(l) && !/^subgraph\b/.test(l.trim())) { buf = l; continue; }
    out.push(l);
  }
  if (buf) out.push(buf);
  return out;
}

export function parseFlowchart(src: string): FlowGraph | null {
  const rawLines = src.replace(/\r/g, '').split('\n').filter(l => l.trim() && !l.trim().startsWith('%%'));
  const lines = joinContinuations(rawLines).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const head = HEAD_RE.exec(lines[0]);
  if (!head) return null;
  const graph: FlowGraph = { direction: head[1] as FlowDirection, nodes: new Map(), edges: [], subgraphs: [] };
  const stack: FlowSubgraph[] = [];
  const hidden = new Set<string>();
  let order = 0;

  const ensureNode = (id: string, label?: string, shape?: FlowShape): FlowNode => {
    let n = graph.nodes.get(id);
    if (!n) {
      n = { id, label: label || id, order: order++ };
      const sg = stack[stack.length - 1]; // 가장 바깥 subgraph 가 레인
      if (sg) { n.subgraph = sg.id; sg.nodes.push(id); }
      graph.nodes.set(id, n);
    } else {
      if (label !== undefined && label !== '') n.label = label;
      // 먼저 엣지에 등장한 노드를 나중에 subgraph 안에서 나열하는 꼴 → 그때 레인에 넣는다
      const sg = stack[stack.length - 1];
      if (sg && !n.subgraph) { n.subgraph = sg.id; if (!sg.nodes.includes(id)) sg.nodes.push(id); }
    }
    if (shape) n.shape = shape;
    return n;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_RE.test(line)) continue;
    if (/^subgraph\b/.test(line)) {
      const m = /^subgraph\s+(.+?)\s*$/.exec(line);
      const spec = m ? m[1] : '';
      const withTitle = /^([^\s[\]"]+)\s*\[\s*"?([\s\S]*?)"?\s*\]$/.exec(spec);
      const sg: FlowSubgraph = withTitle
        ? { id: withTitle[1], title: cleanLabel(withTitle[2]), nodes: [] }
        : { id: spec.replace(/^"|"$/g, ''), title: cleanLabel(spec), nodes: [] };
      if (stack.length === 0) graph.subgraphs.push(sg); // 중첩 subgraph 는 바깥 것만 인정
      stack.push(sg);
      continue;
    }
    if (/^end\b/.test(line)) { stack.pop(); continue; }

    const norm = normalizeInlineLabels(line.replace(/;\s*$/, ''));
    const parts = norm.split(EDGE_SPLIT_RE);
    // split 결과: [node, op, label, node, op, label, node, ...]
    const groups: string[][] = [];
    for (let p = 0; p < parts.length; p += 3) {
      const tok = (parts[p] || '').trim();
      if (!tok) { groups.push([]); continue; }
      const ids: string[] = [];
      for (const piece of splitAmp(tok)) {
        const nt = parseNodeToken(piece);
        if (!nt) continue;
        if (nt.hidden) { hidden.add(nt.id); continue; }
        ensureNode(nt.id, nt.label, nt.shape);
        ids.push(nt.id);
      }
      groups.push(ids);
    }
    for (let p = 1; p + 2 < parts.length + 1; p += 3) {
      const op = parts[p];
      if (!op) continue;
      if (op.startsWith('~')) continue; // 보이지 않는 선(~~~)은 배치용이므로 뺀다
      const label = parts[p + 1] ? cleanLabel(parts[p + 1]) : undefined;
      const fromIds = groups[(p - 1) / 3] || [];
      const toIds = groups[(p - 1) / 3 + 1] || [];
      const open = !/[>xo]$/.test(op);
      for (const f of fromIds) for (const t of toIds) {
        const e: FlowEdge = { from: f, to: t, label: label || undefined, dashed: op.includes('.'), thick: op.includes('='), bidir: op.startsWith('<') };
        if (open) e.open = true;
        graph.edges.push(e);
      }
    }
  }
  // subgraph 사이 엣지(`S1 --> S2`)는 레인 순서로 대신하므로, subgraph id 로 생긴 노드와 그 엣지는 뺀다(Mermaid db 경로와 같은 결과)
  const sgIds = new Set([...graph.subgraphs.map(s => s.id), ...hidden]);
  if (sgIds.size) {
    for (const id of sgIds) graph.nodes.delete(id);
    graph.edges = graph.edges.filter(e => graph.nodes.has(e.from) && graph.nodes.has(e.to));
    for (const s of graph.subgraphs) s.nodes = s.nodes.filter(id => graph.nodes.has(id));
  }
  if (graph.nodes.size === 0) return null;
  return graph;
}

// ────────────────────────────────────────────────────────────────────────────
// Mermaid 자체 파서(db) → FlowGraph
// ────────────────────────────────────────────────────────────────────────────

/** mermaid flowchart db 의 최소 형태(라이브러리 타입에 의존하지 않도록 구조만 선언) */
export interface MermaidFlowDbLike {
  getVertices(): Map<string, MermaidVertexLike> | Record<string, MermaidVertexLike>;
  getEdges(): MermaidEdgeLike[];
  getSubGraphs?(): MermaidSubGraphLike[];
  getDirection?(): string | undefined;
}
export interface MermaidVertexLike { id: string; text?: string; type?: string }
export interface MermaidEdgeLike { start: string; end: string; text?: string; type?: string; stroke?: string }
export interface MermaidSubGraphLike { id: string; title?: string; nodes: string[] }

const SHAPE_OF: Record<string, FlowShape | undefined> = {
  diamond: 'decision', question: 'decision', cylinder: 'cylinder', database: 'cylinder', circle: 'circle', doublecircle: 'circle',
  stadium: 'stadium', round: 'stadium', subroutine: 'subroutine', hexagon: 'hexagon',
};

/** Mermaid 가 파싱한 db 를 FlowGraph 로. 노드 순서는 등장 순서, subgraph 는 바깥 것만 레인으로 두고 안쪽 노드는 바깥에 합친다. */
export function fromMermaidDb(db: MermaidFlowDbLike): FlowGraph | null {
  const vRaw = db.getVertices();
  const verts: MermaidVertexLike[] = vRaw instanceof Map ? Array.from(vRaw.values()) : Object.values(vRaw);
  if (verts.length === 0) return null;
  const dirRaw = (db.getDirection?.() || 'TB').toUpperCase();
  const direction: FlowDirection = (['LR', 'RL', 'TD', 'TB', 'BT'] as const).includes(dirRaw as FlowDirection) ? (dirRaw as FlowDirection) : 'TB';
  const graph: FlowGraph = { direction, nodes: new Map(), edges: [], subgraphs: [] };
  const sgIds = new Set((db.getSubGraphs?.() || []).map(s => s.id));
  let order = 0;
  verts.forEach((v) => {
    if (sgIds.has(v.id)) return; // `style SG …` 줄이 subgraph id 로 만든 유령 정점
    if (typeof v.text === 'string' && v.text.trim() === '') return; // `HSP1[ ]` 빈 칸 노드(간격 맞추기용 투명 노드)는 숨긴다
    const n: FlowNode = { id: v.id, label: cleanLabel(v.text || v.id) || v.id, order: order++ };
    const shape = v.type ? SHAPE_OF[v.type] : undefined;
    if (shape) n.shape = shape;
    graph.nodes.set(v.id, n);
  });
  for (const e of db.getEdges()) {
    if (e.stroke === 'invisible') continue;
    if (!graph.nodes.has(e.start) || !graph.nodes.has(e.end)) continue;
    const fe: FlowEdge = {
      from: e.start, to: e.end, label: e.text ? cleanLabel(e.text) || undefined : undefined,
      dashed: e.stroke === 'dotted', thick: e.stroke === 'thick', bidir: /^double_/.test(e.type || ''),
    };
    if (e.type === 'arrow_open') fe.open = true;
    graph.edges.push(fe);
  }
  // subgraph: 다른 subgraph 의 nodes 에 들어 있는 것은 중첩(안쪽) → 바깥 레인에 펼쳐 넣는다
  const sgs = db.getSubGraphs?.() || [];
  const byId = new Map(sgs.map(s => [s.id, s] as const));
  const nested = new Set<string>();
  for (const s of sgs) for (const c of s.nodes) if (byId.has(c)) nested.add(c);
  const flatten = (s: MermaidSubGraphLike, seen: Set<string>): string[] => {
    const out: string[] = [];
    for (const c of s.nodes) {
      const child = byId.get(c);
      if (child) { if (!seen.has(c)) { seen.add(c); out.push(...flatten(child, seen)); } }
      else if (graph.nodes.has(c)) out.push(c);
    }
    return out;
  };
  // Mermaid 는 `A --> B` 를 [B, A] 순으로 모으므로 레인 안 순서는 원문 등장 순(order)으로 되돌린다
  const top = sgs.filter(s => !nested.has(s.id)).map(s => ({ id: s.id, title: cleanLabel(s.title || s.id), nodes: flatten(s, new Set([s.id])).sort((a, b) => graph.nodes.get(a)!.order - graph.nodes.get(b)!.order) }));
  // Mermaid 는 `end` 를 만날 때 subgraph 를 등록하므로 순서가 바뀔 수 있다 → 첫 노드 등장 순서로 정렬
  const firstOrder = (s: FlowSubgraph) => (s.nodes.length ? Math.min(...s.nodes.map(id => graph.nodes.get(id)!.order)) : Number.MAX_SAFE_INTEGER);
  top.sort((a, b) => firstOrder(a) - firstOrder(b));
  for (const s of top) { graph.subgraphs.push(s); for (const id of s.nodes) { const n = graph.nodes.get(id)!; if (!n.subgraph) n.subgraph = s.id; } }
  return graph;
}

/** 두 그래프가 같은가(노드 id·라벨·모양, 엣지 끝·라벨·선 종류, 레인 구성). 동기 파서 결과를 db 결과로 바꿀지 판단용. */
export function sameFlowGraph(a: FlowGraph, b: FlowGraph): boolean {
  if (a.nodes.size !== b.nodes.size || a.edges.length !== b.edges.length || a.subgraphs.length !== b.subgraphs.length) return false;
  for (const [id, n] of a.nodes) { const m = b.nodes.get(id); if (!m || m.label !== n.label || m.shape !== n.shape || m.subgraph !== n.subgraph) return false; }
  const key = (e: FlowEdge) => `${e.from}>${e.to}|${e.label || ''}|${e.dashed ? 'd' : ''}${e.thick ? 't' : ''}${e.bidir ? 'b' : ''}${e.open ? 'o' : ''}`;
  const ka = a.edges.map(key).sort(), kb = b.edges.map(key).sort();
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return false;
  for (let i = 0; i < a.subgraphs.length; i++) { const p = a.subgraphs[i], q = b.subgraphs[i]; if (p.title !== q.title || p.nodes.join(',') !== q.nodes.join(',')) return false; }
  return true;
}
