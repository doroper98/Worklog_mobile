import type { ElkLike } from '@/islands/flowIslands'

type MermaidApi = typeof import('mermaid')['default']

let mermaidApi: MermaidApi | null = null
let loadPromise: Promise<MermaidApi> | null = null

/**
 * Load the mermaid library once. It is ~150 KB gzip, so the import is dynamic
 * and readers who never open a diagram pay no bundle cost.
 *
 * The ELK layout loader is registered alongside it (desktop v3.108.0 made ELK
 * the default layout — orthogonal routing and a straight main axis are what the
 * new look is built on). elkjs itself is only fetched when a diagram is laid
 * out with `layout: 'elk'`; registering the loader costs nothing up front. A
 * failed ELK import must not take mermaid down with it: the diagram component
 * falls back to dagre when the elk layout rejects.
 */
export function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return Promise.resolve(mermaidApi)
  if (!loadPromise) {
    loadPromise = Promise.all([import('mermaid'), import('@mermaid-js/layout-elk')]).then(
      ([m, elk]) => {
        m.default.registerLayoutLoaders(elk.default)
        mermaidApi = m.default
        return mermaidApi
      },
    )
  }
  return loadPromise
}

let elkPromise: Promise<ElkLike> | null = null

/**
 * ELK instance for the island renderer's relation graphs (desktop v3.92.0
 * `loadElk`). elkjs is the same dependency @mermaid-js/layout-elk uses, so a
 * page that already rendered a mermaid diagram with ELK pays nothing extra.
 * Lazy and created once; a rejected import is retried on the next call.
 */
export function loadElk(): Promise<ElkLike> {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js')
      .then((m) => new m.default() as unknown as ElkLike)
      .catch((err: unknown) => {
        elkPromise = null
        throw err
      })
  }
  return elkPromise
}

let queue: Promise<unknown> = Promise.resolve()

/**
 * Run a mermaid job with every other mermaid job held back until it settles.
 *
 * `initialize`, `render` and `getDiagramFromText` all mutate the same module
 * state inside mermaid — a config object and a diagram registry. Two callers
 * overlapping there produce diagrams rendered with another one's config, or a
 * parse that reads a half-swapped registry. A page holds several diagrams and
 * the island layer parses each of them alongside rendering, so overlap is the
 * normal case here, not an edge one.
 *
 * Jobs are chained rather than gated on a flag, so a rejected job does not
 * strand the queue: the chain continues with the next caller either way.
 */
export function runMermaid<T>(job: (m: MermaidApi) => Promise<T>): Promise<T> {
  const run = queue.then(() => loadMermaid()).then(job)
  queue = run.catch(() => undefined)
  return run
}
