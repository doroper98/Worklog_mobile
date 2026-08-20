import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { MermaidDiagram } from '@/components/MermaidDiagram'

/**
 * Extract plain-text from react-markdown code children. When rehype-highlight
 * processes a block it wraps tokens in span elements, so we walk the tree.
 */
function childrenToText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(childrenToText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props
    if (props && 'children' in props) return childrenToText(props.children)
  }
  return ''
}

/**
 * Replacement for the default <code> element in react-markdown.
 * Intercepts ```mermaid blocks and renders them as SVG diagrams;
 * all other code passes through untouched so existing styling /
 * syntax-highlighting still applies.
 */
export function MarkdownCodeBlock({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'code'>) {
  const match = /language-(\w+)/.exec(className ?? '')
  const lang = match?.[1]

  if (lang === 'mermaid') {
    const source = childrenToText(children).replace(/\n$/, '')
    return <MermaidDiagram source={source} />
  }

  return (
    <code className={className} {...rest}>
      {children}
    </code>
  )
}

/** True when this <pre> wraps a ```mermaid fence. */
function isMermaidBlock(children: ReactNode): boolean {
  const child = Array.isArray(children) ? children[0] : children
  if (!child || typeof child !== 'object' || !('props' in child)) return false
  const className = (child as { props?: { className?: string } }).props?.className
  return typeof className === 'string' && /language-mermaid\b/.test(className)
}

/**
 * Replacement for the default <pre> element.
 *
 * A ```mermaid fence renders as a diagram, not as code, so the <pre> wrapper is
 * dropped for it. Left in place, the browser's built-in `font-family: monospace`
 * on <pre> cascades into the SVG's html labels — mermaid sizes each node by
 * measuring the label in a proportional font, so the monospace text renders far
 * wider than the box reserved for it and gets clipped. Dropping the wrapper also
 * removes its duplicate border and padding around the diagram's own container.
 */
export function MarkdownPre({ children, ...rest }: ComponentPropsWithoutRef<'pre'>) {
  if (isMermaidBlock(children)) return <>{children}</>
  return <pre {...rest}>{children}</pre>
}
