/** Convert HTML content (from slate editor) to pseudo-markdown for ReactMarkdown */
export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  let md = html
    // Base64 images → placeholder
    .replace(/<img[^>]*src="data:image\/[^"]*"[^>]*>/gi, '\n\n[이미지]\n\n')
    // Regular images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    // Block elements to newlines
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/h([1-6])>/gi, '\n\n')
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => '#'.repeat(Number(level)) + ' ')
    // Tables
    .replace(/<\/tr>/gi, '|\n')
    .replace(/<\/?(thead|tbody|tfoot)[^>]*>/gi, '')
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| **$1** ')
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '| $1 ')
    // Bold / italic
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    // Mentions → @Name
    .replace(/<span[^>]*class="tcc-mention"[^>]*data-label="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, '@$1')
    .replace(/<span[^>]*class="tcc-mention"[^>]*>([\s\S]*?)<\/span>/gi, '@$1')
    // Slate refs → [[ref]]
    .replace(/<span[^>]*class="tcc-slate-ref"[^>]*>([\s\S]*?)<\/span>/gi, '[[$1]]')
    // Code
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
    // Horizontal rules
    .replace(/<hr[^>]*>/gi, '\n---\n')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return md
}
