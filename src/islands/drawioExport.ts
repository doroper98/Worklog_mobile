/**
 * drawioExport — 섬(flowIslands) 배치를 draw.io(mxGraph) XML 로 내보낸다 (v3.98.0 / WP8-12).
 *
 * 왜: 사용자가 요구한 레인 체계(본선 세로, 되돌림은 왼쪽 통로 레인별, 가지 오른쪽, 합류 위/아래 면,
 * 포트 분산, 관통 0)는 섬이 이미 코드로 구현하고 239개 전수 검사로 0 을 확인한 것이다.
 * 그러니 ⤴ 승격은 **LLM 없이** 섬 배치를 그대로 draw.io 로 옮긴다(결정적·즉시).
 *
 * 입력: 섬이 만든 SVG 문자열(`data-ww-node` / `data-ww-box` / `data-ww-edge` / `data-ww-item` 표시가 붙어 있다)
 *       + 그 SVG 를 만든 `FlowGraph`(라벨·모양·엣지 라벨의 정본).
 * 출력: `<mxGraphModel>…</mxGraphModel>` 한 덩어리.
 */
import type { FlowGraph, FlowShape } from './mermaidFlowParser';
import type { IslandTokens } from './islandTokens';

interface Box { id: string; x: number; y: number; w: number; h: number; shape: string }
interface Poly { from: string; to: string; kind: string; pts: Array<[number, number]> }
interface Item { parent: string; index: number; text: string; x: number; y: number; w: number; h: number }

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** path 의 `d` 를 직각 폴리라인 좌표로. `Q`(둥근 모서리)는 제어점을 버리고 끝점만 남겨 꺾임점을 복원한다. */
export function pathToPoints(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let x = 0, y = 0;
  const toks = d.match(/[MLHVQmlhvq][^MLHVQmlhvq]*/g) || [];
  for (const tk of toks) {
    const c = tk[0];
    const n = (tk.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (!n.length) continue;
    if (c === 'M' || c === 'L') { x = n[n.length - 2]; y = n[n.length - 1]; }
    else if (c === 'm' || c === 'l') { x += n[n.length - 2]; y += n[n.length - 1]; }
    else if (c === 'H') x = n[n.length - 1];
    else if (c === 'h') x += n[n.length - 1];
    else if (c === 'V') y = n[n.length - 1];
    else if (c === 'v') y += n[n.length - 1];
    else if (c === 'Q') { x = n[n.length - 2]; y = n[n.length - 1]; }      // 제어점 버리고 끝점만
    else if (c === 'q') { x += n[n.length - 2]; y += n[n.length - 1]; }
    out.push([Math.round(x), Math.round(y)]);
  }
  // 같은 점이 이어지거나 한 직선 위에 놓인 가운데 점은 지운다(draw.io 가 다시 꺾지 않게)
  const clean: Array<[number, number]> = [];
  for (const p of out) {
    const last = clean[clean.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 1 && Math.abs(last[1] - p[1]) < 1) continue;
    clean.push(p);
  }
  const simple: Array<[number, number]> = [];
  for (let i = 0; i < clean.length; i++) {
    const a = simple[simple.length - 1], b = clean[i], c = clean[i + 1];
    if (a && c) {
      const abx = b[0] - a[0], aby = b[1] - a[1], bcx = c[0] - b[0], bcy = c[1] - b[1];
      if (Math.abs(abx * bcy - bcx * aby) < 1) continue;   // 일직선 위의 가운데 점
    }
    simple.push(b);
  }
  return simple;
}

/** v3.99.1: 테마 역할 → 이 XML 에 쓰는 색. 섬 토큰을 그대로 받아 쓴다. */
export interface DrawioPalette {
  node: string; nodeStroke: string; text: string;
  flow: string; back: string; ref: string; label: string; hub: string; hubStroke: string;
  font: string;
}
/**
 * v3.99.3: 반투명 토큰을 **배경색 위에 섞어** 불투명 hex 로 만든다.
 * 테두리 토큰(`--yk-border-strong`)은 테마마다 `rgba(…,0.26)` / `color-mix(…, transparent)` 라
 * 알파를 버리고 hex 로만 바꾸면 화면(섬 SVG)보다 훨씬 진한 선이 된다. draw.io style 은 알파를
 * 받지 않으므로, 섬이 실제로 보여 주는 색과 같아지도록 여기서 미리 섞는다.
 */
export function toHexOver(css: string, bg: string): string {
  const v = (css || '').trim();
  let rgb: [number, number, number] | null = null;
  let a = 1;
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/i.exec(v);
  if (m) { rgb = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]; if (m[4]) a = parseFloat(m[4]); }
  const c = /^color\(\s*srgb\s+([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i.exec(v);
  if (c) { rgb = [parseFloat(c[1]) * 255, parseFloat(c[2]) * 255, parseFloat(c[3]) * 255]; if (c[4]) a = parseFloat(c[4]); }
  if (!rgb || !Number.isFinite(a) || a >= 1) return toHex(v);
  const b = toHex(bg);
  const bn = /^#([0-9a-f]{6})$/i.exec(b);
  if (!bn) return toHex(v);
  const bc = [0, 2, 4].map(i => parseInt(bn[1].slice(i, i + 2), 16));
  const mix = rgb.map((x, i) => Math.max(0, Math.min(255, Math.round(x * a + bc[i] * (1 - a)))));
  return `#${mix.map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
export function paletteFromTokens(t: IslandTokens): DrawioPalette {
  return {
    // 테두리는 반투명 토큰이 많다 → 노드 채움 위에 섞어 섬 SVG 와 같은 색으로
    node: toHex(t.surface), nodeStroke: toHexOver(t.borderStrong, t.surface), text: toHex(t.text),
    flow: toHex(t.primary), back: toHex(t.red), ref: toHex(t.muted), label: toHex(t.green),
    hub: toHex(t.blue), hubStroke: toHex(t.primary),
    font: (t.font || 'sans-serif').split(',')[0].replace(/["']/g, '').trim() || 'sans-serif',
  };
}

/** 이 파일이 쓴 색인지 알아보기 위한 역할 이름 목록(재색칠용) */

/** 셀이 그림에서 맡은 역할. style 에 `wwRole=…` 로 적어 두고, 그릴 때 이 값으로 색을 정한다. */
export type WwRole = 'node' | 'hub' | 'item' | 'label' | 'flow' | 'back' | 'ref';

/** style 문자열에서 키 값 읽기 */
function styleGet(style: string, key: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${key}=([^;]*)`, 'i').exec(style);
  return m ? m[1].trim() : null;
}

/** style 문자열에 키 값 쓰기(없으면 끝에 붙인다) */
function styleSet(style: string, key: string, value: string): string {
  const re = new RegExp(`((?:^|;)\\s*${key})=[^;]*`, 'i');
  if (re.test(style)) return style.replace(re, `$1=${value}`);
  return `${style.replace(/;?$/, ';')}${key}=${value};`;
}

/** 붉은 계열인가(되돌림 선 판별용) */
function isRedish(hex: string | null): boolean {
  if (!hex) return false;
  const v = toHex(hex);
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  if (!m) return false;
  const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16));
  return r > 120 && r > g * 1.4 && r > b * 1.4;
}

/**
 * v3.99.4: `wwRole` 이 없는 셀의 역할을 모양·색으로 짐작한다.
 * 옛 편집본, LLM 이 쓴 XML, 사용자가 draw.io 에서 직접 추가한 도형이 여기에 해당한다.
 * 한 번 짐작하면 style 에 태그를 붙여 주므로 다음부터는 그대로 쓴다.
 */
export function guessRole(style: string, isEdge: boolean): WwRole {
  if (isEdge) {
    if (isRedish(styleGet(style, 'strokeColor'))) return 'back';
    if (styleGet(style, 'dashed') === '1') return 'ref';
    return 'flow';
  }
  if (/(?:^|;)\s*edgeLabel/i.test(style)) return 'label';
  if (/(?:^|;)\s*text[;=]/i.test(style)) return 'item';
  if (parseFloat(styleGet(style, 'strokeWidth') || '1') >= 2.5) return 'hub';
  return 'node';
}

/** 역할에 맞는 테마 색을 style 에 덮어쓴다 */
function paintRole(style: string, role: WwRole, pal: DrawioPalette, isEdge: boolean): string {
  let out = style;
  if (isEdge || role === 'flow' || role === 'back' || role === 'ref') {
    const stroke = role === 'back' ? pal.back : role === 'ref' ? pal.ref : pal.flow;
    out = styleSet(out, 'strokeColor', stroke);
    out = styleSet(out, 'fontColor', pal.label);
    out = styleSet(out, 'labelBackgroundColor', pal.node);
    out = styleSet(out, 'labelBorderColor', 'none');   // v3.99.5: 테두리 없음(옛 편집본도 함께 지운다)
    return out;
  }
  if (role === 'item') return styleSet(styleSet(out, 'fontColor', pal.ref), 'labelBackgroundColor', 'none');
  if (role === 'label') {
    out = styleSet(out, 'fontColor', pal.label);
    out = styleSet(out, 'labelBackgroundColor', pal.node);
    out = styleSet(out, 'labelBorderColor', 'none');
    return out;
  }
  const hub = role === 'hub';
  out = styleSet(out, 'fillColor', hub ? pal.hub : pal.node);
  out = styleSet(out, 'strokeColor', hub ? pal.hubStroke : pal.nodeStroke);
  out = styleSet(out, 'fontColor', pal.text);
  return out;
}

/**
 * v3.99.4: 저장된 그림을 **현재 테마 색으로 다시 칠한다** — 이제 hex 를 보지 않고 **역할**로 칠한다.
 *
 * 예전(v3.99.1~3)에는 '테마 10종의 역할색 표에 있는 hex' 만 바꿨다. 그래서 요청서 팔레트로 만든 파일,
 * 재색칠이 무동작이던 동안 저장된 파일, 사용자가 draw.io 에서 고른 색은 표에 없어 그대로 남았고,
 * 같은 문서의 차트끼리 색이 제각각이 됐다(사용자 지적 3).
 *
 * 사용자 결정(2026-09-17): **테마 우선**. 그림의 색은 언제나 앱 테마를 따른다
 * (draw.io 안에서 고른 임의 색은 유지되지 않는다). 대신 배치·모양·글자는 그대로 둔다.
 */
export function recolorXml(xml: string, palette: DrawioPalette): string {
  return xml.replace(/<mxCell\b[^>]*>/g, (tag) => {
    const sm = /style="([^"]*)"/.exec(tag);
    if (!sm || !sm[1].trim()) return tag;          // style 이 없는 셀(root·그룹)은 그대로
    const isEdge = /\bedge="1"/.test(tag);
    let style = sm[1];
    const tagged = styleGet(style, 'wwRole');
    const role = (tagged as WwRole | null) ?? guessRole(style, isEdge);
    if (!tagged) style = styleSet(style, 'wwRole', role);   // 옛 파일에도 태그를 붙여 준다
    style = paintRole(style, role, palette, isEdge);
    return tag.replace(/style="[^"]*"/, `style="${style}"`);
  });
}
/** CSS 색(`rgb(…)`·`#rgb`·`#rrggbb`)을 `#rrggbb` 로. mxGraph style 은 hex 를 쓴다. */
export function toHex(css: string): string {
  const v = (css || '').trim();
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(v);
  if (m) {
    const h = (x: string) => Math.max(0, Math.min(255, Math.round(parseFloat(x)))).toString(16).padStart(2, '0');
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  // v3.99.3: `color-mix(in srgb, …)` 은 브라우저가 `color(srgb 0.93 0.89 0.83 / 0.3)` 으로 계산해 준다.
  //   예전에는 이 값을 그대로 style 에 넣어 draw.io 가 색을 못 읽었다(테마 8종의 테두리색).
  const c = /^color\(\s*srgb\s+([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (c) {
    const h = (x: string) => Math.max(0, Math.min(255, Math.round(parseFloat(x) * 255))).toString(16).padStart(2, '0');
    return `#${h(c[1])}${h(c[2])}${h(c[3])}`;
  }
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  return v || '#000000';
}

/** 저장된 `.drawio.svg` 의 루트 `content` 속성에서 `<mxfile>` XML 을 꺼낸다 */
export function extractMxfileFromSvgText(svgText: string): string {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    return doc.documentElement?.getAttribute('content') || '';
  } catch {
    return '';
  }
}

/** 펜스 첫 줄의 편집본 연결 표시 `%% drawio: <slug>` */
export function drawioSlugOf(mermaidSrc: string): string | null {
  const m = /^\s*%%\s*drawio\s*:\s*([A-Za-z0-9._-]{1,80})\s*$/m.exec(mermaidSrc.split(/\r?\n/).slice(0, 3).join('\n'));
  return m ? m[1] : null;
}

/** 펜스 원문에 `%% drawio: <slug>` 를 넣는다(이미 있으면 교체) */
export function withDrawioMarker(mermaidSrc: string, slug: string): string {
  const lines = mermaidSrc.split(/\r?\n/);
  const i = lines.findIndex(l => /^\s*%%\s*drawio\s*:/.test(l));
  if (i >= 0 && i < 3) { lines[i] = `%% drawio: ${slug}`; return lines.join('\n'); }
  return `%% drawio: ${slug}\n${mermaidSrc}`;
}

/** mxGraph 모양 style (섬의 FlowShape 와 짝) */
function shapeStyle(shape: FlowShape | undefined): string {
  switch (shape) {
    case 'decision': return 'rhombus;';
    case 'stadium': return 'rounded=1;arcSize=50;';
    case 'cylinder': return 'shape=cylinder3;boundedLbl=1;';
    case 'circle': return 'ellipse;';
    case 'hexagon': return 'shape=hexagon;';
    case 'subroutine': return 'shape=process;';
    default: return 'rounded=0;';
  }
}

/** 라벨을 draw.io value 의 **HTML** 로. 첫 줄은 굵게(섬의 제목 줄 규칙과 같다).
 *  여기서 XML 이스케이프를 하지 않는다 — 쓰는 쪽에서 속성값으로 한 번만 한다.
 *  (두 번 하면 `&` 가 `&amp;amp;` 가 되고, 한 번도 안 하면 `<b>` 가 XML 속성을 깨뜨려 도표가 통째로 비어 나온다.) */
function labelValue(label: string): string {
  const lines = label.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (!lines.length) return '';
  const html = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const head = `<b>${html(lines[0])}</b>`;
  return lines.length === 1 ? head : head + '<br>' + lines.slice(1).map(html).join('<br>');
}

/** 점을 상자 기준 0~1 분수로(그 면에 딱 붙게 반올림) */
function frac(p: [number, number], b: Box): { x: number; y: number } {
  const fx = b.w > 0 ? (p[0] - b.x) / b.w : 0.5;
  const fy = b.h > 0 ? (p[1] - b.y) / b.h : 0.5;
  const clamp = (v: number) => Math.max(0, Math.min(1, Math.round(v * 1000) / 1000));
  return { x: clamp(fx), y: clamp(fy) };
}

/**
 * 섬 SVG + FlowGraph → mxGraphModel XML.
 * 렌더러(브라우저)에서 돌린다 — `DOMParser` 를 쓴다.
 */
export function islandToDrawio(svg: string, g: FlowGraph, opts: { font: string; palette?: DrawioPalette }): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName === 'parsererror') throw new Error('섬 SVG 를 읽지 못했습니다');

  // ── 노드 ──
  const boxes = new Map<string, Box>();
  root.querySelectorAll('[data-ww-node]').forEach((el) => {
    const id = el.getAttribute('data-ww-node') || '';
    const raw = (el.getAttribute('data-ww-box') || '').split(',').map(Number);
    if (!id || raw.length !== 4 || raw.some(v => !Number.isFinite(v))) return;
    if (boxes.has(id)) return;                                   // 같은 노드가 두 번 그려지면 처음 것
    boxes.set(id, { id, x: raw[0], y: raw[1], w: raw[2], h: raw[3], shape: el.getAttribute('data-ww-shape') || 'box' });
  });

  // ── 선 ──
  const polys: Poly[] = [];
  root.querySelectorAll('[data-ww-edge]').forEach((el) => {
    const key = el.getAttribute('data-ww-edge') || '';
    const i = key.indexOf('>>');
    if (i < 0) return;
    const from = key.slice(0, i), to = key.slice(i + 2);
    if (!boxes.has(from) || !boxes.has(to)) return;
    const pts = pathToPoints(el.getAttribute('d') || '');
    if (pts.length < 2) return;
    polys.push({ from, to, kind: el.getAttribute('data-ww-kind') || 'flow', pts });
  });

  // ── 잎·입력 항목 ──
  const items: Item[] = [];
  root.querySelectorAll('[data-ww-item]').forEach((el) => {
    const key = (el.getAttribute('data-ww-item') || '').split('|');
    const text = el.getAttribute('data-ww-text') || '';
    if (key.length !== 2 || !text) return;
    items.push({
      parent: key[0], index: Number(key[1]) || 0, text,
      x: Number(el.getAttribute('x')) || 0, y: Number(el.getAttribute('y')) || 0,
      w: Number(el.getAttribute('width')) || 120, h: Number(el.getAttribute('height')) || 18,
    });
  });

  // ── 허브(되돌림 유입이 많은 노드) 강조: 섬과 같은 기준 ──
  const inDeg = new Map<string, number>();
  for (const e of g.edges) inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);

  // ── 엣지 라벨(정본은 FlowGraph) ──
  const edgeLabel = new Map<string, string>();
  for (const e of g.edges) if (e.label) edgeLabel.set(`${e.from}>>${e.to}`, e.label.replace(/\n/g, ' '));

  const out: string[] = [];
  out.push('<mxGraphModel dx="0" dy="0" grid="0" page="0" adaptiveColors="auto"><root>');
  out.push('<mxCell id="0"/><mxCell id="1" parent="0"/>');

  // v3.99.1: 색은 앱 테마 토큰에서 온다(없으면 예전 고정값 — 하네스·단위 시험용)
  const pal: DrawioPalette = opts.palette ?? {
    node: '#ffffff', nodeStroke: '#182129', text: '#182129',
    flow: '#245E7C', back: '#B8321E', ref: '#6B7684', label: '#1E7C3A',
    hub: '#CFE0EA', hubStroke: '#245E7C', font: opts.font,
  };
  const common = `fontFamily=${pal.font};fontColor=${pal.text};whiteSpace=wrap;html=1;`;
  for (const b of boxes.values()) {
    const nd = g.nodes.get(b.id);
    const hub = (inDeg.get(b.id) || 0) >= 3;
    // v3.99.4: `wwRole` 태그 — 나중에 어떤 테마로 열어도 이 역할대로 다시 칠한다(draw.io 는 모르는 style 키를 그대로 보존한다)
    const style = shapeStyle(nd?.shape) + common +
      (hub ? `fillColor=${pal.hub};strokeColor=${pal.hubStroke};strokeWidth=2.5;wwRole=hub;` : `fillColor=${pal.node};strokeColor=${pal.nodeStroke};wwRole=node;`);
    out.push(`<mxCell id="${esc(b.id)}" value="${esc(labelValue(nd?.label || b.id))}" style="${style}" vertex="1" parent="1">`
      + `<mxGeometry x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" as="geometry"/></mxCell>`);
  }

  items.forEach((it, i) => {
    out.push(`<mxCell id="ww-item-${i}" value="${esc(it.text)}" `
      + `style="text;html=1;align=left;verticalAlign=top;fontSize=11;fontColor=${pal.ref};fontFamily=${pal.font};labelBackgroundColor=none;wwRole=item;" vertex="1" parent="1">`
      + `<mxGeometry x="${Math.round(it.x)}" y="${Math.round(it.y)}" width="${Math.round(it.w)}" height="${Math.round(it.h)}" as="geometry"/></mxCell>`);
  });

  polys.forEach((p, i) => {
    const a = boxes.get(p.from)!, b = boxes.get(p.to)!;
    const s = frac(p.pts[0], a), t2 = frac(p.pts[p.pts.length - 1], b);
    const mid = p.pts.slice(1, -1);
    const role: WwRole = p.kind === 'back' || p.kind === 'no' ? 'back' : p.kind === 'ref' ? 'ref' : 'flow';
    const color = role === 'back' ? pal.back : role === 'ref' ? pal.ref : pal.flow;
    const dash = p.kind === 'ref' ? 'dashed=1;dashPattern=1 3;' : '';
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeWidth=2;strokeColor=${color};${dash}`
      // v3.99.3: 선 라벨(예/아니오 등)은 draw.io 기본이 **흰 상자**라 어두운 테마에서 글자가 묻힌다
      //   → 배경·테두리를 테마 색(노드 채움·테두리)으로 못박는다.
      + `exitX=${s.x};exitY=${s.y};entryX=${t2.x};entryY=${t2.y};fontFamily=${pal.font};fontColor=${pal.label};`
      // v3.99.5: 라벨 **테두리는 없다**(사용자 요청). 배경만 테마 노드색으로 둬 선이 글자를 가로지르지 않게 한다.
      + `labelBackgroundColor=${pal.node};labelBorderColor=none;wwRole=${role};`;
    const label = edgeLabel.get(`${p.from}>>${p.to}`) || '';
    const points = mid.length
      ? `<Array as="points">${mid.map(q => `<mxPoint x="${q[0]}" y="${q[1]}"/>`).join('')}</Array>`
      : '';
    out.push(`<mxCell id="ww-e${i}" value="${esc(label)}" style="${style}" edge="1" parent="1" `
      + `source="${esc(p.from)}" target="${esc(p.to)}"><mxGeometry relative="1" as="geometry">${points}</mxGeometry></mxCell>`);
  });

  out.push('</root></mxGraphModel>');
  return out.join('\n');
}
