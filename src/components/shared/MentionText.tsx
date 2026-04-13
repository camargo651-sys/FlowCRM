'use client'
import { renderMentionsToHTML } from '@/lib/mentions/parse'

interface MentionTextProps {
  text: string
  className?: string
}

// Render text containing @[Name](userId) tokens with styled mentions.
// The renderer escapes all non-mention text, so dangerouslySetInnerHTML is safe.
export default function MentionText({ text, className }: MentionTextProps) {
  const html = renderMentionsToHTML(text || '')
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
