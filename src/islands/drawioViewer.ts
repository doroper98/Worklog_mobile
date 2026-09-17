/**
 * drawioViewer — draw.io 정적 뷰어를 앱 안에서 오프라인으로 돌린다 (v3.99.1 / WP8-16).
 *
 * 사용자 결정(2026-09-17): 흐름도 블록의 보이는 뷰를 섬 SVG 에서 **draw.io 렌더**로 바꾼다.
 * 정본은 마크다운의 ```mermaid 그대로이고, 여기서 그리는 것은 화면 표시뿐이다.
 *
 * 번들: `vendor/drawio/viewer-static.min.js`(Apache-2.0, 4,176,048B). vite publicDir 로
 * `dist/renderer/vendor/drawio/` 에 그대로 실린다. 네트워크 호출 없이 로컬 파일만 읽는다.
 */

interface GraphViewerLike {
  createViewerForElement(el: HTMLElement, callback?: (v: unknown) => void): void;
}

let loadPromise: Promise<GraphViewerLike> | null = null;

/** 뷰어 스크립트를 한 번만 주입하고 `window.GraphViewer` 를 돌려준다. */
export function loadGraphViewer(): Promise<GraphViewerLike> {
  if (!loadPromise) {
    loadPromise = new Promise<GraphViewerLike>((resolve, reject) => {
      const w = window as unknown as { GraphViewer?: GraphViewerLike; mxLoadResources?: boolean };
      if (w.GraphViewer) { resolve(w.GraphViewer); return; }
      // dev(localhost:5173)·prod(app://bundle/) 모두 문서 기준 상대 경로로 잡힌다
      const src = new URL('vendor/drawio/viewer-static.min.js', document.baseURI).toString();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => {
        // 스크립트가 전역을 세울 때까지 잠깐 기다린다(자체 초기화가 한 틱 늦는 경우가 있다)
        let tries = 0;
        const tick = () => {
          if (w.GraphViewer) { resolve(w.GraphViewer); return; }
          if (++tries > 100) { reject(new Error('GraphViewer 전역이 만들어지지 않았습니다')); return; }
          window.setTimeout(tick, 20);
        };
        tick();
      };
      s.onerror = () => reject(new Error(`draw.io 뷰어를 읽지 못했습니다: ${src}`));
      document.head.appendChild(s);
    }).catch((e) => { loadPromise = null; throw e; });
  }
  return loadPromise;
}

/** 이미 읽혔는지(폴백 판단용) */
export function isGraphViewerLoaded(): boolean {
  return !!(window as unknown as { GraphViewer?: unknown }).GraphViewer;
}

/**
 * XML 을 무대에 그린다. `resize:true` 라 뷰어가 컨테이너 폭에 맞춰 축소한다.
 * 축소율이 너무 작아지면(0.6 미만) 축소 대신 가로 스크롤이 되도록 최소 폭을 준다.
 */
export async function renderDrawioXml(stage: HTMLElement, xml: string, opts?: { minScale?: number }): Promise<void> {
  const GV = await loadGraphViewer();
  const minScale = opts?.minScale ?? 0.6;
  stage.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'mxgraph';
  host.style.maxWidth = '100%';
  // 자연 폭을 미리 재서, 무대가 그보다 훨씬 좁으면 축소 대신 가로 스크롤로 보낸다
  const natural = naturalWidthOf(xml);
  const stageW = stage.clientWidth || 0;
  if (natural > 0 && stageW > 0 && stageW / natural < minScale) {
    host.style.minWidth = `${Math.round(natural * minScale)}px`;
  }
  // v3.99.3: lightbox:false — 그림을 클릭해도 '크게 보기' 창이 뜨지 않는다(편집은 ✎ 편집/더블클릭)
  // v3.99.4: `toolbar` 키는 **넣지 않는다** — 뷰어는 toolbar 가 null 이 아니면 호버 시 툴바 막대를 그린다.
  //   빈 문자열이라 내용 없는 **흰 가로 막대**가 떴다(사용자 지적 2).
  host.setAttribute('data-mxgraph', JSON.stringify({ xml, nav: false, resize: true, border: 8, lightbox: false }));
  stage.appendChild(host);
  GV.createViewerForElement(host);
}

/** mxGraphModel 의 vertex 좌표로 자연 폭을 어림한다(뷰어를 돌리기 전에 알아야 한다). */
export function naturalWidthOf(xml: string): number {
  let max = 0;
  const re = /<mxGeometry\b[^>]*\bx="(-?[\d.]+)"[^>]*\bwidth="([\d.]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const right = parseFloat(m[1]) + parseFloat(m[2]);
    if (Number.isFinite(right)) max = Math.max(max, right);
  }
  return max ? Math.ceil(max + 24) : 0;
}

/** 한 라벨 줄 */
interface LabelLine { text: string; bold: boolean }

/** 라벨 HTML 을 줄 단위로 편다(<br>·블록 요소가 줄바꿈, <b>/굵은 글씨는 줄 단위로 표시). */
function labelLines(root: HTMLElement): LabelLine[] {
  const lines: LabelLine[] = [];
  let buf = '';
  let allBold = true;
  const flush = (): void => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) lines.push({ text: t, bold: allBold });
    buf = ''; allBold = true;
  };
  const walk = (n: Node, bold: boolean): void => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = n.nodeValue || '';
      if (t.trim()) { buf += t; if (!bold) allBold = false; }
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') { flush(); return; }
    const cs = window.getComputedStyle(n);
    const b = bold || tag === 'b' || tag === 'strong' || parseInt(cs.fontWeight, 10) >= 600;
    const block = n !== root && (tag === 'div' || tag === 'p' || cs.display === 'block');
    if (block) flush();
    n.childNodes.forEach(c => walk(c, b));
    if (block) flush();
  };
  walk(root, false);
  flush();
  return lines;
}

/** 뷰어가 쓰는 `light-dark(밝은색, 어두운색)` 는 그림으로 구울 때 **밝은 쪽**이 나온다.
 *  상자 채움·테두리와 어긋나지 않게 글자도 같은 규칙(첫 인자)으로 고른다. */
function labelColor(el: HTMLElement, stop: Element): string {
  let cur: HTMLElement | null = el;
  while (cur && cur !== stop) {
    const raw = cur.style.color || '';
    const m = /light-dark\(\s*([^,]+),/.exec(raw);
    if (m) return m[1].trim();
    if (raw.trim()) return raw.trim();
    cur = cur.parentElement;
  }
  return window.getComputedStyle(el).color || '#000';
}

/** foreignObject 안에서 글자를 실제로 담고 있는 가장 깊은 요소 */
function innermostLabel(fo: Element): HTMLElement | null {
  const want = (fo.textContent || '').trim();
  if (!want) return null;
  let best: HTMLElement | null = null;
  let depth = -1;
  fo.querySelectorAll<HTMLElement>('div, p, span').forEach(el => {
    if ((el.textContent || '').trim() !== want) return;
    let d = 0;
    for (let p: Element | null = el; p && p !== fo; p = p.parentElement) d++;
    if (d > depth) { depth = d; best = el; }
  });
  return best;
}

/**
 * 메일 복사용 — 뷰어 SVG 의 HTML 라벨(foreignObject)을 `<text>` 로 바꾼다 (v3.99.1).
 *
 * Chromium 은 `<img>` 로 읽은 SVG 안의 foreignObject 를 **그리지 않는다**. 그대로 PNG 로 구우면
 * 상자·선만 남고 글자가 전부 사라지므로, 화면에 붙어 있는 원본(`orig`)에서 위치·글꼴·색을 재서
 * 복사본(`clone`)의 같은 순서 노드를 `<text>` 로 바꿔치기한다. 원본은 건드리지 않는다.
 */
export function flattenForeignObjectLabels(orig: SVGElement, clone: SVGElement): number {
  const origFos = Array.from(orig.querySelectorAll('foreignObject'));
  const cloneFos = Array.from(clone.querySelectorAll('foreignObject'));
  if (!origFos.length) return 0;
  const NS = 'http://www.w3.org/2000/svg';
  const rootRect = orig.getBoundingClientRect();
  const rootCtm = (orig as unknown as SVGGraphicsElement).getScreenCTM?.() ?? null;
  const inv = rootCtm ? rootCtm.inverse() : null;
  const toLocal = (x: number, y: number): [number, number] => {
    if (!inv) return [x - rootRect.left, y - rootRect.top];
    const p = new DOMPoint(x, y).matrixTransform(inv);
    return [p.x, p.y];
  };
  let made = 0;
  origFos.forEach((fo, i) => {
    const cf = cloneFos[i];
    if (cf && cf.parentNode) cf.parentNode.removeChild(cf);
    const label = innermostLabel(fo);
    if (!label) return;
    const lines = labelLines(label);
    if (!lines.length) return;
    const cs = window.getComputedStyle(label);
    const foCtm = (fo as unknown as SVGGraphicsElement).getScreenCTM?.() ?? null;
    const ratio = foCtm && rootCtm && rootCtm.a ? foCtm.a / rootCtm.a : 1;
    const fs = (parseFloat(cs.fontSize) || 12) * (ratio || 1);
    const lh = fs * 1.25;
    const r = label.getBoundingClientRect();
    const align = cs.textAlign === 'right' ? 'end' : cs.textAlign === 'left' || cs.textAlign === 'start' ? 'start' : 'middle';
    const anchorX = align === 'start' ? r.left : align === 'end' ? r.right : r.left + r.width / 2;
    const [lx, cy] = toLocal(anchorX, r.top + r.height / 2);
    const top = cy - (lines.length * lh) / 2;
    lines.forEach((ln, k) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', lx.toFixed(1));
      t.setAttribute('y', (top + lh * (k + 0.5) + fs * 0.35).toFixed(1));
      t.setAttribute('text-anchor', align);
      t.setAttribute('font-family', cs.fontFamily || 'sans-serif');
      t.setAttribute('font-size', fs.toFixed(1));
      t.setAttribute('fill', labelColor(label, fo));
      if (ln.bold) t.setAttribute('font-weight', '700');
      t.textContent = ln.text;
      clone.appendChild(t);
      made++;
    });
  });
  return made;
}
