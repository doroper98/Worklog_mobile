import {
  headerCellsOf,
  isTableSeparator,
  isTableViewComment,
  normHeaderCell,
} from '@/islands/viewMarkers'

/**
 * Carry each table's `<!-- ww:view=… -->` marker from the markdown source into
 * the rendered DOM.
 *
 * applyIslands reads a table's stored view from the Comment node immediately
 * before its `<table>` — that is how the desktop renderer delivers it, because
 * marked passes HTML comments straight through. react-markdown does not: raw
 * HTML is dropped unless rehype-raw is added, which would also start rendering
 * every other HTML fragment in the document. So mobile reads the markers from
 * the source instead and inserts the Comment nodes itself, leaving both the
 * copied island modules and the markdown source untouched.
 *
 * Tables are matched positionally: the Nth GFM table in the source is the Nth
 * `<table>` in the output. Header text is compared as a guard so a mismatch
 * skips the marker rather than applying it to the wrong table.
 */

interface SourceTable {
  headers: string[]
  view: string
}

/** Find every GFM table in the source, in order, with the marker above it. */
function sourceTables(markdown: string): SourceTable[] {
  const lines = markdown.split('\n')
  const out: SourceTable[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Tables inside a fenced block are code, not tables
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue

    const headers = headerCellsOf(line)
    if (!headers || i + 1 >= lines.length || !isTableSeparator(lines[i + 1])) continue

    // The marker sits on the line directly above, with no blank line between
    let view = ''
    const above = i > 0 ? lines[i - 1] : ''
    if (isTableViewComment(above)) view = above

    out.push({ headers, view })
    // Skip to the end of this table so its body rows are not re-examined
    i++
    while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) i++
  }
  return out
}

/** Header cells of a rendered table, normalized the same way as the source. */
function domHeaders(table: Element): string[] {
  const row = table.querySelector('tr')
  return row ? Array.from(row.children).map((c) => normHeaderCell(c.textContent || '')) : []
}

/**
 * Insert the source's table view markers into `container` as Comment nodes.
 * Safe to call repeatedly — a marker already in place is left alone.
 */
export function applyTableViewMarkers(container: HTMLElement, markdown: string): void {
  const marked = sourceTables(markdown)
  if (!marked.some((t) => t.view)) return

  const tables = Array.from(container.querySelectorAll('table'))
  const limit = Math.min(tables.length, marked.length)

  for (let i = 0; i < limit; i++) {
    const { headers, view } = marked[i]
    if (!view) continue
    const table = tables[i]
    // Positional match only counts if the headers agree
    const actual = domHeaders(table)
    if (actual.length !== headers.length || actual.some((h, j) => h !== headers[j])) continue

    const prev = table.previousSibling
    if (prev && prev.nodeType === Node.COMMENT_NODE) continue
    table.parentNode?.insertBefore(document.createComment(view.replace(/^\s*<!--/, '').replace(/-->\s*$/, '')), table)
  }
}
