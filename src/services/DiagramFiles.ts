import { GitHubClient } from '@/services/GitHubClient'

/** slug → file text, kept for the session so re-renders do not refetch */
const cache = new Map<string, string | null>()

/**
 * Expand a draw.io `<diagram>` payload that was stored deflate-compressed.
 *
 * draw.io's embedded editor saves each diagram as base64(deflateRaw(percent-
 * encoded XML)). The viewer expands that itself, but the island layer's
 * recolouring works on the XML text — it rewrites the style of every `<mxCell>`
 * so the drawing takes the app's current theme colours. Against a compressed
 * payload there are no `<mxCell>` tags to match, so it silently leaves the
 * file's stored colours in place and a document ends up with charts in several
 * different palettes.
 *
 * Handing back an expanded copy puts the file in the form the recolouring
 * already expects. Uncompressed diagrams are valid draw.io either way, and the
 * stored file is never written to — this only affects what is rendered.
 */
async function inflateDiagrams(svgText: string): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return svgText

  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName === 'parsererror') return svgText
  const content = root.getAttribute('content')
  if (!content || content.includes('<mxCell')) return svgText

  const mx = new DOMParser().parseFromString(content, 'application/xml')
  if (mx.documentElement?.nodeName === 'parsererror') return svgText

  const diagrams = Array.from(mx.querySelectorAll('diagram'))
  let changed = false

  for (const d of diagrams) {
    const payload = (d.textContent || '').trim()
    if (!payload || payload.includes('<')) continue
    try {
      const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      const raw = await new Response(stream).text()
      const inner = new DOMParser().parseFromString(decodeURIComponent(raw), 'application/xml')
      if (inner.documentElement?.nodeName === 'parsererror') continue
      d.textContent = ''
      d.appendChild(mx.importNode(inner.documentElement, true))
      changed = true
    } catch {
      // A payload we cannot expand keeps its stored colours — still renders.
    }
  }

  if (!changed) return svgText
  root.setAttribute('content', new XMLSerializer().serializeToString(mx))
  return new XMLSerializer().serializeToString(doc)
}

/**
 * Read an edited diagram file (`diagrams/<slug>.drawio.svg`) from the data
 * repository as text.
 *
 * A flow block carrying a `%% drawio: <slug>` marker was laid out by hand on
 * the desktop; that file is the drawing to show instead of the one the island
 * engine derives. Returns null when there is no such file, which is the normal
 * case — the caller then draws from the mermaid source.
 */
export async function readDiagram(slug: string): Promise<string | null> {
  const cached = cache.get(slug)
  if (cached !== undefined) return cached

  const path = `diagrams/${slug}.drawio.svg`
  try {
    const bytes = await GitHubClient.getBinaryFile(path)
    const text = await inflateDiagrams(new TextDecoder('utf-8').decode(bytes))
    cache.set(slug, text)
    return text
  } catch {
    // Missing file is expected; anything else (offline, auth) is equally
    // non-fatal here, so both fall back to the derived drawing.
    cache.set(slug, null)
    return null
  }
}
