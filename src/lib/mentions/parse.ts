// Utilities for parsing @[Name](userId) mention markdown.

export interface ParsedMention {
  id: string
  name: string
}

export interface ParseMentionsResult {
  mentions: ParsedMention[]
  rendered: string
}

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function parseMentions(text: string): ParseMentionsResult {
  const mentions: ParsedMention[] = []
  if (!text) return { mentions, rendered: '' }

  const rendered = text.replace(MENTION_RE, (_m, name: string, id: string) => {
    mentions.push({ id, name })
    return `@${name}`
  })

  return { mentions, rendered }
}

export function extractMentionIds(text: string): string[] {
  if (!text) return []
  const ids: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(MENTION_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    ids.push(match[2])
  }
  return ids
}

export function renderMentionsToHTML(text: string): string {
  if (!text) return ''
  // Split around mention matches and escape non-mention segments.
  let result = ''
  let lastIndex = 0
  const re = new RegExp(MENTION_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, m.index))
    const name = escapeHtml(m[1])
    result += `<span class="text-brand-600 font-semibold">@${name}</span>`
    lastIndex = m.index + m[0].length
  }
  result += escapeHtml(text.slice(lastIndex))
  return result.replace(/\n/g, '<br />')
}
