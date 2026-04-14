// Visual message editor block model + serializers.
// Blocks are the source of truth; HTML (for email) and plain text (for WhatsApp)
// are generated at send time so the user never touches markup.

export type BlockType =
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'video'
  | 'spacer'

export interface Block {
  id: string
  type: BlockType
  content: string
  meta?: Record<string, unknown>
}

export const EMAIL_BLOCK_TYPES: BlockType[] = [
  'heading', 'text', 'image', 'button', 'divider', 'video', 'spacer',
]
export const WHATSAPP_BLOCK_TYPES: BlockType[] = [
  'text', 'image', 'video', 'button',
]

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function makeBlock(type: BlockType): Block {
  switch (type) {
    case 'heading': return { id: newId(), type, content: 'Your headline here' }
    case 'text':    return { id: newId(), type, content: 'Write your message here. Use {{first_name}} for personalization.' }
    case 'image':   return { id: newId(), type, content: '', meta: { url: '', alt: '' } }
    case 'button':  return { id: newId(), type, content: 'Click here', meta: { url: 'https://' } }
    case 'divider': return { id: newId(), type, content: '' }
    case 'video':   return { id: newId(), type, content: '', meta: { url: '' } }
    case 'spacer':  return { id: newId(), type, content: '', meta: { size: 24 } }
  }
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphs(text: string): string {
  return esc(text)
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;color:#374068;font-size:15px;line-height:1.7;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

/** Convert blocks to inline-styled HTML (email) or plain text (WhatsApp). */
export function blocksToHTML(blocks: Block[], type: 'email' | 'whatsapp'): string {
  if (type === 'whatsapp') return blocksToWhatsAppText(blocks)

  const body = blocks.map(b => {
    switch (b.type) {
      case 'heading':
        return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#151b3a;line-height:1.25;">${esc(b.content)}</h1>`
      case 'text':
        return paragraphs(b.content)
      case 'image': {
        const url = esc(String(b.meta?.url || ''))
        const alt = esc(String(b.meta?.alt || ''))
        if (!url) return ''
        return `<div style="margin:12px 0;text-align:center;"><img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:12px;display:inline-block;"/></div>`
      }
      case 'button': {
        const url = esc(String(b.meta?.url || '#'))
        return `<div style="margin:20px 0;text-align:center;"><a href="${url}" style="display:inline-block;padding:14px 32px;background:#0891B2;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px;">${esc(b.content || 'Click here')}</a></div>`
      }
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>`
      case 'video': {
        const url = esc(String(b.meta?.url || ''))
        if (!url) return ''
        return `<div style="margin:12px 0;text-align:center;"><a href="${url}" style="color:#0891B2;font-weight:600;text-decoration:none;">Watch video →</a></div>`
      }
      case 'spacer': {
        const size = Number(b.meta?.size ?? 24)
        return `<div style="height:${size}px;line-height:${size}px;">&nbsp;</div>`
      }
    }
  }).join('\n')

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#ffffff;">${body}</div>`
}

/** WhatsApp doesn't support HTML — we emit plain text with URLs for media. */
export function blocksToWhatsAppText(blocks: Block[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': parts.push(`*${b.content}*`); break
      case 'text':    parts.push(b.content); break
      case 'image': {
        const url = String(b.meta?.url || '')
        if (url) parts.push(`📷 ${url}`)
        break
      }
      case 'video': {
        const url = String(b.meta?.url || '')
        if (url) parts.push(`🎥 ${url}`)
        break
      }
      case 'button': {
        const url = String(b.meta?.url || '')
        parts.push(url ? `${b.content}: ${url}` : b.content)
        break
      }
    }
  }
  return parts.filter(Boolean).join('\n\n')
}

/** Best-effort legacy loader: if we only have HTML, show it as one text block with tags stripped. */
export function htmlToBlocks(html: string): Block[] {
  if (!html) return []
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return [{ id: newId(), type: 'text', content: stripped }]
}

/** Pre-built templates so users can start from a ready-made layout. */
export const EMAIL_TEMPLATES: { name: string; subject: string; blocks: Block[] }[] = [
  {
    name: 'Announcement',
    subject: 'Big news from {{company}}',
    blocks: [
      { id: newId(), type: 'heading', content: 'Something new from {{company}}' },
      { id: newId(), type: 'text', content: "Hi {{first_name}},\n\nWe're excited to share what we've been working on. Here's what's new:" },
      { id: newId(), type: 'image', content: '', meta: { url: '', alt: 'Announcement' } },
      { id: newId(), type: 'button', content: 'Learn more', meta: { url: 'https://' } },
    ],
  },
  {
    name: 'Promotion',
    subject: 'Special offer for {{first_name}}',
    blocks: [
      { id: newId(), type: 'heading', content: 'Special offer inside' },
      { id: newId(), type: 'text', content: 'Hi {{first_name}}, for a limited time we have something just for you.' },
      { id: newId(), type: 'button', content: 'Claim 20% OFF', meta: { url: 'https://' } },
      { id: newId(), type: 'divider', content: '' },
      { id: newId(), type: 'text', content: 'Questions? Just reply to this email — we read every message.' },
    ],
  },
  {
    name: 'Follow-up',
    subject: 'Quick follow-up, {{first_name}}',
    blocks: [
      { id: newId(), type: 'text', content: "Hi {{first_name}},\n\nI wanted to follow up on our last conversation. Do you have any questions I can help with?\n\nI'd love to schedule a quick call this week if you're available." },
      { id: newId(), type: 'button', content: 'Book a call', meta: { url: 'https://' } },
    ],
  },
  {
    name: 'Welcome',
    subject: 'Welcome to {{company}}',
    blocks: [
      { id: newId(), type: 'heading', content: 'Welcome, {{first_name}}!' },
      { id: newId(), type: 'text', content: "We're thrilled to have you on board. Here are a few things to help you get started." },
      { id: newId(), type: 'button', content: 'Get started', meta: { url: 'https://' } },
    ],
  },
]

export const WHATSAPP_TEMPLATES: { name: string; blocks: Block[] }[] = [
  {
    name: 'Follow-up',
    blocks: [
      { id: newId(), type: 'text', content: 'Hi {{first_name}}, just following up on our conversation. Any questions? Happy to help!' },
    ],
  },
  {
    name: 'Promotion',
    blocks: [
      { id: newId(), type: 'text', content: '🎉 Hi {{first_name}}! We have a special offer for you.' },
      { id: newId(), type: 'button', content: 'See offer', meta: { url: 'https://' } },
    ],
  },
  {
    name: 'Appointment',
    blocks: [
      { id: newId(), type: 'text', content: 'Hi {{first_name}}, this is a reminder about your upcoming appointment. Please reply OK to confirm.' },
    ],
  },
  {
    name: 'Thank you',
    blocks: [
      { id: newId(), type: 'text', content: 'Hi {{first_name}}, thank you for your recent purchase! We appreciate your business. 🙏' },
    ],
  },
]
