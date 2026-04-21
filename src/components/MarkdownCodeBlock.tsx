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
