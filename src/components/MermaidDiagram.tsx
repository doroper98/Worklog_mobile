import { useEffect, useRef, useState, useId } from 'react'

import { runMermaid } from '@/services/MermaidRunner'
import { useTheme } from '@/hooks/useTheme'
import { isThemeKey, paletteFor } from '@/styles/palettes'
import type { EffectiveTheme } from '@/types'

interface Props {
  source: string
}

/**
 * Mermaid measures html labels in a detached element, then the SVG is injected
 * inside .ww-markdown. Any font difference between those two contexts makes the
 * rendered text wider than the box mermaid sized for it, which clips the label.
 * Pinning the exact family and size (matched by the CSS in markdown.css) keeps
 * measurement and render identical.
 */
const LABEL_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif'
const LABEL_FONT_SIZE = 14

type MermaidLayout = 'elk' | 'dagre'

/** The ported palettes carry their own light/dark mode; the two base themes are named. */
function isDarkTheme(theme: EffectiveTheme): boolean {
  if (theme === 'dark') return true
  if (isThemeKey(theme)) return paletteFor(theme)?.mode === 'dark'
  return false
}

/**
 * Neo-look palette, ported from desktop v3.108.0 (MarkdownPanel `mermaidConfig`).
 *
 * Light values are the desktop's exactly: box #f3f3f3, 10% black border, text
 * #414141, 1px #8f8f8f lines, opaque white edge-label pills. The desktop always
 * draws on a white card; this app has dark palettes, so the dark set keeps the
 * same gray, low-contrast impression on a dark surface instead of forcing a
 * white card into a dark page.
 *
 * These are baked into the SVG by mermaid. The CSS in markdown.css paints the
 * same values on top with !important, because the neo look also writes its own
 * rules into the SVG under the diagram's id (`#id [data-look=neo] .node rect`),
 * and id specificity beats any class selector — the desktop uses the same trick.
 */
function neoThemeVariables(dark: boolean) {
  return dark
    ? {
        fontFamily: LABEL_FONT, fontSize: `${LABEL_FONT_SIZE}px`,
        primaryColor: '#2c3047', primaryBorderColor: 'rgba(255,255,255,0.12)', primaryTextColor: '#c9cfe8',
        lineColor: '#8b90ad', secondaryColor: '#2a2e44', tertiaryColor: '#262a40',
        clusterBkg: '#2c3047', clusterBorder: 'rgba(255,255,255,0.12)', edgeLabelBackground: '#24283b', background: '#24283b',
      }
    : {
        fontFamily: LABEL_FONT, fontSize: `${LABEL_FONT_SIZE}px`,
        primaryColor: '#f3f3f3', primaryBorderColor: 'rgba(0,0,0,0.10)', primaryTextColor: '#414141',
        lineColor: '#8f8f8f', secondaryColor: '#f9f9f9', tertiaryColor: '#fcfcfc',
        clusterBkg: '#f3f3f3', clusterBorder: 'rgba(0,0,0,0.10)', edgeLabelBackground: '#ffffff', background: '#ffffff',
      }
}

function mermaidConfig(layout: MermaidLayout, dark: boolean) {
  return {
    startOnLoad: false,
    // Desktop v3.108.0: neo look + redux-color theme + gray palette. All of it
    // ships in mermaid 11.17, no major bump needed.
    theme: (dark ? 'redux-dark-color' : 'redux-color') as 'redux-dark-color' | 'redux-color',
    look: 'neo' as const,
    securityLevel: 'strict' as const,
    // SVG labels rather than html ones: a foreignObject is sized from a
    // measurement that Korean text overruns, so the label spills outside
    // its node. <text> is measured by the same engine that draws it.
    htmlLabels: false,
    flowchart: {
      htmlLabels: false,
      curve: 'basis' as const,
      // Wrap long labels into several lines instead of one wide node —
      // narrow phone screens shrink a wide diagram past readability.
      wrappingWidth: 180,
      padding: 10,
    },
    fontFamily: LABEL_FONT,
    fontSize: LABEL_FONT_SIZE,
    themeVariables: neoThemeVariables(dark),
    layout,
    // Ignored when layout is 'dagre'. Same values as the desktop: the main
    // flow stands on one vertical axis (NETWORK_SIMPLEX), side branches step
    // out left and right, and parallel edges stay separate lines.
    elk: {
      mergeEdges: false,
      nodePlacementStrategy: 'NETWORK_SIMPLEX' as const,
      considerModelOrder: 'NODES_AND_EDGES' as const,
      keepEntryNodeOnTop: true,
    },
  }
}

/**
 * Desktop v3.108.0 `polishMermaidSvg`: widen each edge label's background rect
 * so the opaque pill has breathing room around the text. CSS cannot change an
 * SVG rect's geometry, so it is patched after render.
 */
function polishMermaidSvg(root: HTMLElement): void {
  root.querySelectorAll<SVGRectElement>('.edgeLabel .label rect.background').forEach((r) => {
    if (r.dataset.wwPolished) return
    const x = parseFloat(r.getAttribute('x') || '0')
    const y = parseFloat(r.getAttribute('y') || '0')
    const w = parseFloat(r.getAttribute('width') || '0')
    const h = parseFloat(r.getAttribute('height') || '0')
    if (!w || !h) return
    r.setAttribute('x', String(x - 10))
    r.setAttribute('width', String(w + 20))
    r.setAttribute('y', String(y - 3))
    r.setAttribute('height', String(h + 6))
    r.dataset.wwPolished = '1'
  })
}

/**
 * Render a Mermaid flowchart. The mermaid library (~150 KB gzip) is
 * loaded on first use via dynamic import so users who never open a
 * diagram pay no bundle cost.
 *
 * Layout is ELK by default (desktop v3.108.0): orthogonal routing with the
 * main flow on one vertical axis. elkjs is another lazy chunk; when it cannot
 * be loaded (first visit offline, before the service worker has it) the
 * diagram is drawn with mermaid's built-in dagre instead of failing.
 */
export function MermaidDiagram({ source }: Props) {
  const { effectiveTheme } = useTheme()
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const reactId = useId()
  const renderId = `ww-mm-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`
  const dark = isDarkTheme(effectiveTheme)

  useEffect(() => {
    let cancelled = false

    const renderWith = (layout: MermaidLayout) =>
      // Queued with every other mermaid call, including the island layer's
      // flowchart parse — they share mermaid's module-level config and registry.
      runMermaid(async (mermaid) => {
        if (cancelled) return null
        mermaid.initialize(mermaidConfig(layout, dark))
        return mermaid.render(renderId, source)
      })

    renderWith('elk')
      .catch((err: unknown) => {
        if (cancelled) return null
        // A parse error fails the same way under dagre; only retry when the
        // ELK layout itself was the problem (its chunk missing or the layout
        // throwing), so a real syntax error still surfaces once.
        const msg = err instanceof Error ? err.message : String(err)
        if (/elk|layout|Failed to fetch|import/i.test(msg)) return renderWith('dagre')
        throw err
      })
      .then((result) => {
        if (cancelled || !result) return
        if (hostRef.current) {
          hostRef.current.innerHTML = result.svg
          polishMermaidSvg(hostRef.current)
        }
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      })

    return () => { cancelled = true }
  }, [source, dark, renderId])

  if (error) {
    return (
      <div
        className="my-3 overflow-auto rounded-xl border p-3 font-mono text-[11px]"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-danger)',
          color: 'var(--color-text-muted)',
        }}
      >
        <div className="mb-1.5 font-bold" style={{ color: 'var(--color-danger)' }}>
          Mermaid 렌더링 실패
        </div>
        <div className="mb-2 whitespace-pre-wrap">{error}</div>
        <pre className="m-0 whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
          {source}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="ww-mermaid my-3 overflow-auto rounded-xl border p-3"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    />
  )
}
