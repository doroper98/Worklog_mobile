type MermaidApi = typeof import('mermaid')['default']

let mermaidApi: MermaidApi | null = null
let loadPromise: Promise<MermaidApi> | null = null

/**
 * Load the mermaid library once. It is ~150 KB gzip, so the import is dynamic
 * and readers who never open a diagram pay no bundle cost.
 */
export function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return Promise.resolve(mermaidApi)
  if (!loadPromise) {
    loadPromise = import('mermaid').then((m) => {
      mermaidApi = m.default
      return mermaidApi
    })
  }
  return loadPromise
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
