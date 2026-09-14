/**
 * islandTokens — 섬(island) 렌더러가 쓰는 테마 색·글꼴을 앱의 --yk-* 토큰에서 읽어 온다.
 *
 * v3.87.0: 마크다운 섬 도입.
 *  - SVG 의 fill/stroke 는 CSS 변수를 직접 받지 못하는 경우(color-mix 등)가 있어,
 *    숨은 probe 요소에 `color: var(--yk-...)` 를 걸고 computed 값(rgb/rgba)으로 해석한다.
 *  - 테마(data-theme)가 바뀌면 캐시를 버린다.
 *  - React 의존 없음. 모바일(PWA)에서도 같은 파일을 그대로 쓸 수 있게 DOM API 만 쓴다.
 */

export interface IslandTokens {
  text: string;
  text2: string;
  muted: string;
  primary: string;
  surface: string;
  border: string;
  borderStrong: string;
  green: string;
  orange: string;
  red: string;
  blue: string;
  font: string;
  mono: string;
}

const TOKEN_VARS: Record<Exclude<keyof IslandTokens, 'font' | 'mono'>, string> = {
  text: '--yk-text',
  text2: '--yk-text-secondary',
  muted: '--yk-text-muted',
  primary: '--yk-primary',
  surface: '--yk-surface-solid',
  border: '--yk-border-color',
  borderStrong: '--yk-border-strong',
  green: '--yk-green',
  orange: '--yk-orange',
  red: '--yk-red',
  blue: '--yk-blue',
};

const FALLBACK: IslandTokens = {
  text: '#ffffff', text2: '#d0d8e8', muted: '#8899bb', primary: '#7aa2f7', surface: '#24283b',
  border: 'rgba(192,192,192,0.3)', borderStrong: 'rgba(192,192,192,0.5)',
  green: '#34c759', orange: '#ff9500', red: '#ff3b30', blue: '#007aff',
  font: "'Inter','Noto Sans KR',system-ui,sans-serif", mono: "'JetBrains Mono',monospace",
};

let cache: { theme: string; tokens: IslandTokens } | null = null;

function currentThemeKey(): string {
  return document.documentElement.getAttribute('data-theme') || 'default';
}

/** 현재 테마의 토큰을 해석해 반환한다 (테마별 캐시). */
export function resolveIslandTokens(): IslandTokens {
  const theme = currentThemeKey();
  if (cache && cache.theme === theme) return cache.tokens;
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.left = '-9999px';
  probe.style.top = '0';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const out: IslandTokens = { ...FALLBACK };
  try {
    for (const key of Object.keys(TOKEN_VARS) as Array<keyof typeof TOKEN_VARS>) {
      probe.style.color = `var(${TOKEN_VARS[key]}, ${FALLBACK[key]})`;
      const c = getComputedStyle(probe).color;
      if (c && c !== 'rgba(0, 0, 0, 0)') out[key] = c;
    }
    probe.style.fontFamily = 'var(--yk-font)';
    const ff = getComputedStyle(probe).fontFamily;
    if (ff) out.font = ff;
    probe.style.fontFamily = 'var(--yk-font-mono)';
    const fm = getComputedStyle(probe).fontFamily;
    if (fm) out.mono = fm;
  } finally {
    probe.remove();
  }
  cache = { theme, tokens: out };
  return out;
}

/** 테마 변경 등으로 캐시를 강제로 비운다. */
export function invalidateIslandTokens(): void {
  cache = null;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** 캔버스 measureText 기반 글자 폭. 섬 SVG 는 글자 크기를 고정하므로 폭을 직접 잰다. */
export function measureText(text: string, size: number, weight: number, family: string): number {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (!measureCtx) return text.length * size * 0.6;
  measureCtx.font = `${weight} ${size}px ${family}`;
  return measureCtx.measureText(text).width;
}

/** 폭 제한에 맞춰 줄바꿈. 띄어쓰기 없는 긴 한글은 글자 단위로 자른다. */
export function wrapText(text: string, maxW: number, size: number, weight: number, family: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  const fits = (s: string) => measureText(s, size, weight, family) <= maxW;
  const push = (word: string) => {
    const t = cur ? `${cur} ${word}` : word;
    if (fits(t) || !cur) cur = t;
    else { lines.push(cur); cur = word; }
  };
  for (const word of words) {
    if (!fits(word)) {
      let chunk = '';
      for (const ch of word) {
        const t = chunk + ch;
        if (!fits((cur ? `${cur} ` : '') + t) && chunk) { push(chunk); chunk = ch; }
        else chunk = t;
      }
      if (chunk) push(chunk);
    } else push(word);
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

/** 균형 줄바꿈: 같은 줄 수를 유지하는 가장 좁은 폭으로 다시 감싸 줄 길이를 비슷하게 만든다.
 *  (가운데 정렬 노드에서 첫 줄만 길고 둘째 줄이 짧은 모양을 피한다) */
export function wrapBalanced(text: string, maxW: number, size: number, weight: number, family: string): string[] {
  const base = wrapText(text, maxW, size, weight, family);
  if (base.length <= 1) return base;
  let best = base;
  for (let w = maxW - 8; w >= maxW * 0.55; w -= 8) {
    const cand = wrapText(text, w, size, weight, family);
    if (cand.length !== base.length) break;
    best = cand;
  }
  return best;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** SVG 요소 문자열 생성 (undefined/null/false 속성은 생략). */
export function svgEl(tag: string, attrs: Record<string, string | number | undefined | null | false>, inner?: string): string {
  let s = `<${tag}`;
  for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v === undefined || v === null || v === false) continue;
    s += ` ${k}="${escapeXml(String(v))}"`;
  }
  return inner === undefined ? `${s}/>` : `${s}>${inner}</${tag}>`;
}

export interface TextOpts {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: 'start' | 'middle' | 'end';
  family?: string;
  opacity?: number;
}

export function svgText(x: number, y: number, text: string, o: TextOpts, t: IslandTokens): string {
  return svgEl('text', {
    x, y,
    'font-family': o.family || t.font,
    'font-size': o.size ?? 12.5,
    'font-weight': o.weight ?? 400,
    fill: o.fill || t.text,
    'text-anchor': o.anchor,
    'fill-opacity': o.opacity,
  }, escapeXml(text));
}
