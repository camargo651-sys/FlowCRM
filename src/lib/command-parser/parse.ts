/**
 * Natural language command parser (deterministic, rule-based).
 * Supports Spanish + English. Covers ~80% of common cases:
 *  - "crear deal Acme 50000 cierra viernes"
 *  - "nuevo contacto María García maria@acme.com"
 *  - "task llamar a Pedro mañana"
 *  - "schedule meeting con Juan lunes 10am"
 *  - "move deal Acme a Won"
 *  - "search [query]" or plain text → search
 *  - "/go pipeline" → navigate
 *  - "help" → help
 */

export type CommandAction = 'create' | 'update' | 'navigate' | 'search' | 'help'
export type CommandEntity = 'deal' | 'contact' | 'task' | 'meeting'

export interface ParsedCommand {
  action: CommandAction
  entity?: CommandEntity
  fields?: Record<string, unknown>
  query?: string
  confidence: number
  raw: string
  // Human-readable summary for UI preview
  preview?: string
}

const CREATE_KW = ['crear', 'nuevo', 'nueva', 'create', 'new', 'add', 'añadir', 'agregar']
const DEAL_KW = ['deal', 'oportunidad', 'negocio']
const CONTACT_KW = ['contacto', 'contact', 'cliente', 'lead']
const TASK_KW = ['task', 'tarea', 'todo', 'pendiente']
const MEETING_KW = ['meeting', 'reunion', 'reunión', 'cita', 'appointment', 'call']
const MOVE_KW = ['move', 'mover', 'cambiar', 'mark']
const NAVIGATE_KW = ['/go', 'ir a', 'goto', 'go to', 'abrir', 'open']
const HELP_KW = ['help', 'ayuda', '?']

// Phone-call verbs that turn a task into "call Pedro"
const CALL_VERBS = ['llamar', 'call', 'phone', 'telefonear']

const EMAIL_RX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/
const MONEY_RX = /(?:\$|usd\s*|€|eur\s*)?\s*([\d.,]+)\s*(k|mil|million|m)?/i
const TIME_RX = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

function lower(s: string): string {
  return s.toLowerCase().trim()
}

function hasAny(text: string, kws: string[]): boolean {
  const t = ` ${lower(text)} `
  return kws.some(k => t.includes(` ${k} `) || t.startsWith(`${k} `) || t.endsWith(` ${k}`))
}

function startsWithAny(text: string, kws: string[]): boolean {
  const t = lower(text)
  return kws.some(k => t === k || t.startsWith(k + ' '))
}

/** Parse numbers like "50k", "50,000", "$50000", "1.2m" → number */
export function parseMoney(s: string): number | null {
  const m = s.match(MONEY_RX)
  if (!m) return null
  const raw = m[1].replace(/[,.](?=\d{3}\b)/g, '')
  const num = parseFloat(raw.replace(',', '.'))
  if (isNaN(num)) return null
  const suffix = (m[2] || '').toLowerCase()
  if (suffix === 'k' || suffix === 'mil') return num * 1_000
  if (suffix === 'm' || suffix === 'million') return num * 1_000_000
  return num
}

/** Parse dates in Spanish/English: hoy, mañana, viernes próximo, next friday, lunes 10am */
export function parseDate(input: string, now: Date = new Date()): Date | null {
  const s = lower(input)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  // today / hoy
  if (/\b(hoy|today)\b/.test(s)) return applyTime(today, s)
  // tomorrow / mañana
  if (/\b(mañana|manana|tomorrow)\b/.test(s)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return applyTime(d, s)
  }
  // yesterday / ayer
  if (/\b(ayer|yesterday)\b/.test(s)) {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return applyTime(d, s)
  }

  // weekdays
  const days: Record<string, number> = {
    domingo: 0, sunday: 0,
    lunes: 1, monday: 1,
    martes: 2, tuesday: 2,
    miercoles: 3, miércoles: 3, wednesday: 3,
    jueves: 4, thursday: 4,
    viernes: 5, friday: 5,
    sabado: 6, sábado: 6, saturday: 6,
  }
  for (const [name, dow] of Object.entries(days)) {
    if (s.includes(name)) {
      const d = new Date(today)
      const cur = d.getDay()
      let diff = (dow - cur + 7) % 7
      // "próximo/next" or same-day → push to next week
      const isNext = /\b(próximo|proximo|next|que viene|siguiente)\b/.test(s)
      if (diff === 0) diff = 7
      if (isNext && diff < 7) diff += 0 // next is "the next occurrence"
      d.setDate(d.getDate() + diff)
      return applyTime(d, s)
    }
  }

  // in N days
  const inN = s.match(/in\s+(\d+)\s+days?|en\s+(\d+)\s+d[ií]as?/)
  if (inN) {
    const n = parseInt(inN[1] || inN[2])
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return applyTime(d, s)
  }

  // ISO date
  const iso = s.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (iso) {
    const d = new Date(iso[1])
    if (!isNaN(d.getTime())) return applyTime(d, s)
  }

  return null
}

function applyTime(date: Date, s: string): Date {
  const m = s.match(TIME_RX)
  if (!m) return date
  let hour = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const mer = (m[3] || '').toLowerCase()
  if (mer === 'pm' && hour < 12) hour += 12
  if (mer === 'am' && hour === 12) hour = 0
  // Ignore lone small numbers that might not be times (e.g. "50")
  if (hour > 23 || min > 59) return date
  if (!m[3] && !m[2] && hour > 12) return date // probably not a time
  const d = new Date(date)
  d.setHours(hour, min, 0, 0)
  return d
}

/** Extract a name after keyword "a" / "to" / "con" / "with" */
export function extractNameAfter(input: string, keywords: string[]): string | null {
  for (const kw of keywords) {
    const rx = new RegExp(`\\b${kw}\\s+([A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚÑáéíóúñ'-]+(?:\\s+[A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚÑáéíóúñ'-]+)?)`, 'u')
    const m = input.match(rx)
    if (m) return m[1].trim()
  }
  return null
}

function stripKeywords(text: string, kws: string[]): string {
  let out = text
  for (const k of kws) {
    out = out.replace(new RegExp(`\\b${k}\\b`, 'gi'), ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

function formatPreviewDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
}

export function parseCommand(input: string): ParsedCommand | null {
  const raw = input.trim()
  if (!raw) return null
  const lc = lower(raw)

  // Help
  if (HELP_KW.includes(lc)) {
    return { action: 'help', confidence: 1, raw, preview: 'Show help' }
  }

  // Navigate
  if (startsWithAny(raw, NAVIGATE_KW)) {
    const target = stripKeywords(raw, NAVIGATE_KW).toLowerCase()
    return {
      action: 'navigate',
      query: target,
      confidence: 0.9,
      raw,
      preview: `Navigate to ${target}`,
    }
  }

  // Explicit search
  if (startsWithAny(raw, ['search', 'buscar', 'find'])) {
    const q = stripKeywords(raw, ['search', 'buscar', 'find'])
    return { action: 'search', query: q, confidence: 1, raw, preview: `Search "${q}"` }
  }

  // Move / update deal status
  if (startsWithAny(raw, MOVE_KW) && hasAny(raw, DEAL_KW)) {
    // "move deal Acme a Won" / "mark deal Acme as lost"
    const statusMatch = raw.match(/\b(won|lost|open|ganado|perdido|abierto|on.?hold)\b/i)
    const status = statusMatch ? normalizeStatus(statusMatch[1]) : undefined
    // Name between "deal" and "a"/"as"/"to"
    const nameMatch = raw.match(/deal\s+(.+?)(?:\s+(?:a|as|to|al)\b|$)/i)
    const title = nameMatch ? nameMatch[1].trim() : undefined
    return {
      action: 'update',
      entity: 'deal',
      fields: { title, status },
      confidence: title && status ? 0.85 : 0.5,
      raw,
      preview: title && status ? `Move deal "${title}" → ${status}` : 'Update deal',
    }
  }

  // Task: "task llamar a Pedro mañana" OR "llamar a Pedro mañana"
  const isTask = startsWithAny(raw, TASK_KW) || CALL_VERBS.some(v => new RegExp(`\\b${v}\\b`, 'i').test(raw))
  const isMeeting = hasAny(raw, MEETING_KW) || /\bschedule\b/i.test(raw)

  if ((startsWithAny(raw, CREATE_KW) && hasAny(raw, MEETING_KW)) || (startsWithAny(raw, ['schedule']) && isMeeting)) {
    const date = parseDate(raw) || undefined
    const name = extractNameAfter(raw, ['con', 'with'])
    const title = name ? `Meeting with ${name}` : 'Meeting'
    return {
      action: 'create',
      entity: 'meeting',
      fields: {
        title,
        contact_name: name,
        due_date: date?.toISOString(),
      },
      confidence: name && date ? 0.85 : 0.6,
      raw,
      preview: `Meeting${name ? ` with ${name}` : ''}${date ? ` on ${formatPreviewDate(date)}` : ''}`,
    }
  }

  if (isTask) {
    const date = parseDate(raw) || undefined
    const name = extractNameAfter(raw, ['a', 'to', 'con', 'with'])
    // Title = remainder without task/date/"a Name"
    let title = stripKeywords(raw, TASK_KW)
    // Remove date tokens
    title = title.replace(/\b(hoy|today|mañana|manana|tomorrow|ayer|yesterday|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|pr[oó]ximo|next)\b/gi, '')
    title = title.replace(/\s+/g, ' ').trim()
    if (!title) title = 'Task'
    return {
      action: 'create',
      entity: 'task',
      fields: {
        title,
        contact_name: name,
        due_date: date?.toISOString(),
      },
      confidence: 0.75,
      raw,
      preview: `Task "${title}"${name ? ` (re: ${name})` : ''}${date ? ` due ${formatPreviewDate(date)}` : ''}`,
    }
  }

  // Create deal: "crear deal Acme 50000 cierra viernes"
  if (startsWithAny(raw, CREATE_KW) && hasAny(raw, DEAL_KW)) {
    // Strip create + deal keywords to get remainder
    let rest = stripKeywords(raw, [...CREATE_KW, ...DEAL_KW])
    const money = parseMoney(rest)
    // After parsing, remove the money token
    if (money !== null) {
      rest = rest.replace(MONEY_RX, ' ').replace(/\s+/g, ' ').trim()
    }
    // "cierra X" / "closes X" / "close X"
    const closeMatch = rest.match(/\b(?:cierra|closes?|cierre|due)\s+(.+)$/i)
    let closeDate: Date | null = null
    if (closeMatch) {
      closeDate = parseDate(closeMatch[1])
      rest = rest.replace(closeMatch[0], '').trim()
    } else {
      closeDate = parseDate(rest)
      if (closeDate) {
        rest = rest.replace(/\b(hoy|today|mañana|manana|tomorrow|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|pr[oó]ximo|next)\b/gi, '').trim()
      }
    }
    const title = rest.replace(/\s+/g, ' ').trim() || 'Untitled'
    return {
      action: 'create',
      entity: 'deal',
      fields: {
        title,
        value: money ?? undefined,
        expected_close_date: closeDate?.toISOString().slice(0, 10),
      },
      confidence: 0.85,
      raw,
      preview: `Deal "${title}"${money ? ` $${money.toLocaleString()}` : ''}${closeDate ? ` closes ${formatPreviewDate(closeDate)}` : ''}`,
    }
  }

  // Create contact: "nuevo contacto María García maria@acme.com"
  if (startsWithAny(raw, CREATE_KW) && hasAny(raw, CONTACT_KW)) {
    const rest = stripKeywords(raw, [...CREATE_KW, ...CONTACT_KW])
    const email = rest.match(EMAIL_RX)?.[0]
    const name = (email ? rest.replace(email, '') : rest).replace(/\s+/g, ' ').trim()
    return {
      action: 'create',
      entity: 'contact',
      fields: {
        name: name || 'New contact',
        email,
      },
      confidence: name ? 0.9 : 0.5,
      raw,
      preview: `Contact "${name || '(no name)'}"${email ? ` <${email}>` : ''}`,
    }
  }

  // Fallback: not a command → search
  return null
}

function normalizeStatus(s: string): string {
  const lc = s.toLowerCase().replace(/[-_ ]/g, '')
  if (lc === 'won' || lc === 'ganado') return 'won'
  if (lc === 'lost' || lc === 'perdido') return 'lost'
  if (lc === 'onhold') return 'on_hold'
  return 'open'
}

export const HELP_EXAMPLES = [
  'crear deal Acme 50000 cierra viernes',
  'nuevo contacto María García maria@acme.com',
  'task llamar a Pedro mañana',
  'schedule meeting con Juan lunes 10am',
  'move deal Acme a Won',
  '/go pipeline',
  'search invoices',
]
