/** Minimal self-contained Markdown renderer for the preview pane. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderInline(text: string): string {
  let s = text
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => '<code>' + c + '</code>')
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, url: string) => `<img src="${url}" alt="${alt}">`)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => `<a href="${url}">${label}</a>`)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return s
}

export function renderMarkdown(src: string): string {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  const codeBuf: string[] = []
  const paragraph: string[] = []
  let inCode = false
  let listTag: 'ul' | 'ol' | null = null
  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      html.push('<p>' + renderInline(escapeHtml(paragraph.join(' '))) + '</p>')
      paragraph.length = 0
    }
  }
  const closeList = (): void => {
    if (listTag !== null) {
      html.push('</' + listTag + '>')
      listTag = null
    }
  }
  const ensureList = (tag: 'ul' | 'ol'): void => {
    if (listTag !== tag) {
      closeList()
      html.push('<' + tag + '>')
      listTag = tag
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed === '') {
      flushParagraph()
      closeList()
      continue
    }
    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence) {
      flushParagraph()
      closeList()
      if (inCode) {
        html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>')
        codeBuf.length = 0
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`)
      continue
    }
    if (/^\s*([-*_])\s*\1\s*\1\s*$/.test(line)) {
      flushParagraph()
      closeList()
      html.push('<hr>')
      continue
    }
    if (/^>\s?/.test(line)) {
      flushParagraph()
      closeList()
      html.push('<blockquote>' + renderInline(escapeHtml(line.replace(/^>\s?/, ''))) + '</blockquote>')
      continue
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ul) {
      flushParagraph()
      ensureList('ul')
      html.push('<li>' + renderInline(escapeHtml(ul[1])) + '</li>')
      continue
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ol) {
      flushParagraph()
      ensureList('ol')
      html.push('<li>' + renderInline(escapeHtml(ol[1])) + '</li>')
      continue
    }
    paragraph.push(line)
  }
  if (inCode) {
    html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>')
  }
  flushParagraph()
  closeList()
  return html.join('\n')
}
