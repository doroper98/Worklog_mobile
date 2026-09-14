/**
 * mermaidFlowParser — Mermaid flowchart/graph 소스의 부분집합을 그래프로 읽는다.
 *
 * v3.87.0: 마크다운 섬 도입. LLM 이 이미 내는 ```mermaid 블록을 손대지 않고,
 *  렌더러가 파싱해 "섬"(글자 크기 고정 SVG)으로도, Mermaid 로도 그릴 수 있게 한다.
 *
 * 지원 범위 (Workwiki 생성물에서 실제로 쓰이는 문법):
 *  - `flowchart|graph LR|RL|TD|TB|BT`
 *  - 노드 `A[label]` `A["label"]` `A(label)` `A((label))` `A{label}` `A>label]` `A[/label/]` — 라벨 안 <br/> 은 공백
 *  - 엣지 `-->` `---` `-.->` `-.-` `==>` `===` `<-->`, 라벨 `-->|t|` `-- t -->` `-. t .->` `-.t.->` `== t ==>`
 *  - 한 줄 사슬 `A --> B --> C`, `A & B --> C`
 *  - `subgraph ID["title"]` … `end`  (중첩은 바깥만 인정)
 *  - `%%` 주석, classDef/class/style/linkStyle/click 은 무시
 * 그 밖의 다이어그램(sequence, gantt 등)은 null 을 돌려 Mermaid 렌더로 남긴다.
 */

export type FlowDirection = 'LR' | 'RL' | 'TD' | 'TB' | 'BT';

export interface FlowNode {
  id: string;
  label: string;
  subgraph?: string;
  order: number;
  /** `{…}` 마름모 = 결정 노드 */
  shape?: 'decision';
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  thick: boolean;
  bidir: boolean;
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
const EDGE_SPLIT_RE = /\s*(<?(?:-{2,}|={2,}|-\.+-?)(?:>|x|o)?)(?:\|([^|]*)\|)?\s*/g;

function cleanLabel(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `A["label"]` 류에서 id 와 label 을 분리. label 이 없으면 undefined. */
function parseNodeToken(token: string): { id: string; label?: string; decision?: boolean } | null {
  const m = /^([A-Za-z0-9_][\w-]*)\s*([\s\S]*)$/.exec(token.trim());
  if (!m) return null;
  const id = m[1];
  const rest = m[2].trim();
  if (!rest) return { id };
  const inner = rest.replace(/^[[({>/\\]+/, '').replace(/[\])}/\\]+$/, '');
  return { id, label: cleanLabel(inner), decision: rest.startsWith('{') };
}

/** 라벨을 몸통 안에 쓰는 형태(`-- t -->`, `-.t.->`, `== t ==>`)를 `-->|t|` 로 정규화 */
function normalizeInlineLabels(line: string): string {
  return line
    .replace(/-\.\s*([^.\-|>][^.]*?)\s*\.->/g, (_m, t: string) => `-.->|${t.trim()}|`)
    .replace(/-\.\s*([^.\-|>][^.]*?)\s*\.-(?!>)/g, (_m, t: string) => `-.-|${t.trim()}|`)
    .replace(/==\s+([^=<>|][^=]*?)\s+==>/g, (_m, t: string) => `==>|${t.trim()}|`)
    .replace(/--\s+([^\->|][^-]*?)\s+-->/g, (_m, t: string) => `-->|${t.trim()}|`)
    .replace(/--\s+([^\->|][^-]*?)\s+---/g, (_m, t: string) => `---|${t.trim()}|`);
}

export function parseFlowchart(src: string): FlowGraph | null {
  const lines = src.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
  if (lines.length === 0) return null;
  const head = HEAD_RE.exec(lines[0]);
  if (!head) return null;
  const graph: FlowGraph = { direction: head[1] as FlowDirection, nodes: new Map(), edges: [], subgraphs: [] };
  const stack: FlowSubgraph[] = [];
  let order = 0;

  const ensureNode = (id: string, label?: string, decision?: boolean): FlowNode => {
    let n = graph.nodes.get(id);
    if (decision && n) n.shape = 'decision';
    if (!n) {
      n = { id, label: label ?? id, order: order++ };
      if (decision) n.shape = 'decision';
      const sg = stack[0];
      if (sg) { n.subgraph = sg.id; sg.nodes.push(id); }
      graph.nodes.set(id, n);
    } else if (label !== undefined && label !== '' && n.label === n.id) {
      n.label = label;
    } else if (label !== undefined && label !== '') {
      n.label = label;
    }
    return n;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_RE.test(line)) continue;
    if (/^subgraph\b/.test(line)) {
      const m = /^subgraph\s+(.+?)\s*$/.exec(line);
      const spec = m ? m[1] : '';
      const withTitle = /^([\w-]+)\s*\[\s*"?([\s\S]*?)"?\s*\]$/.exec(spec);
      const sg: FlowSubgraph = withTitle
        ? { id: withTitle[1], title: cleanLabel(withTitle[2]), nodes: [] }
        : { id: spec.replace(/^"|"$/g, ''), title: cleanLabel(spec), nodes: [] };
      if (stack.length === 0) graph.subgraphs.push(sg); // 중첩 subgraph 는 바깥 것만 인정
      stack.unshift(sg);
      continue;
    }
    if (/^end\b/.test(line)) { stack.shift(); continue; }

    const norm = normalizeInlineLabels(line.replace(/;\s*$/, ''));
    const parts = norm.split(EDGE_SPLIT_RE);
    // split 결과: [node, op, label, node, op, label, node, ...]
    const groups: string[][] = [];
    for (let p = 0; p < parts.length; p += 3) {
      const tok = (parts[p] || '').trim();
      if (!tok) { groups.push([]); continue; }
      const ids: string[] = [];
      for (const piece of tok.split(/\s+&\s+/)) {
        const nt = parseNodeToken(piece);
        if (!nt) continue;
        ensureNode(nt.id, nt.label, nt.decision);
        ids.push(nt.id);
      }
      groups.push(ids);
    }
    for (let p = 1; p + 2 < parts.length + 1; p += 3) {
      const op = parts[p];
      if (!op) continue;
      const label = parts[p + 1] ? cleanLabel(parts[p + 1]) : undefined;
      const fromIds = groups[(p - 1) / 3] || [];
      const toIds = groups[(p - 1) / 3 + 1] || [];
      for (const f of fromIds) for (const t of toIds) {
        graph.edges.push({ from: f, to: t, label: label || undefined, dashed: op.includes('.'), thick: op.includes('='), bidir: op.startsWith('<') });
      }
    }
  }
  if (graph.nodes.size === 0) return null;
  return graph;
}
