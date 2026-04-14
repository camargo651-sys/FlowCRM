/**
 * AI text summarization with OpenAI (gpt-4o-mini) + deterministic fallback.
 * In-memory cache keyed by hash(text|type).
 */

export type SummaryType = 'call' | 'email' | 'deal' | 'ticket'

export interface SummaryResult {
  summary: string
  bullets: string[]
  sentiment?: 'positive' | 'neutral' | 'negative'
  provider: 'openai' | 'fallback'
}

const CACHE = new Map<string, SummaryResult>()
const MAX_CACHE = 200

function hash(s: string): string {
  // djb2
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

function splitSentences(text: string): string[] {
  // Split on sentence terminators. Avoid lookbehind/u flag for ES5 compatibility.
  const cleaned = text.replace(/\s+/g, ' ')
  const parts: string[] = []
  let buf = ''
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]
    buf += ch
    if (ch === '.' || ch === '!' || ch === '?') {
      // peek next non-space
      let j = i + 1
      while (j < cleaned.length && cleaned[j] === ' ') j++
      const next = cleaned[j]
      if (!next || /[A-ZÁÉÍÓÚÑ¿¡"'(]/.test(next)) {
        parts.push(buf.trim())
        buf = ''
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts.filter(Boolean)
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'have', 'will',
  'are', 'was', 'not', 'but', 'you', 'our', 'can', 'has', 'had', 'all', 'any',
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'con', 'por', 'para', 'una',
  'uno', 'se', 'es', 'un', 'lo', 'al', 'en', 'y', 'o', 'a', 'su', 'sus', 'como',
  'pero', 'más', 'mas', 'no', 'si', 'sí', 'ya', 'muy', 'este', 'esta', 'estos',
])

function deterministicSummary(text: string, type: SummaryType): SummaryResult {
  const clean = text.replace(/\s+/g, ' ').trim()
  const sentences = splitSentences(clean)
  const summary = sentences.slice(0, 2).join(' ') || clean.slice(0, 240)

  // Top keywords (avoid \p{L} which needs u flag)
  const words = clean.toLowerCase().match(/[a-záéíóúñüA-ZÁÉÍÓÚÑÜ]{4,}/g) || []
  const freq: Record<string, number> = {}
  for (const w of words) {
    if (STOPWORDS.has(w)) continue
    freq[w] = (freq[w] || 0) + 1
  }
  const topKeywords = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 5)

  // Build 3 bullets from top sentences containing top keywords
  const scored = sentences
    .map(s => {
      const lc = s.toLowerCase()
      let score = 0
      for (const k of topKeywords) if (lc.includes(k)) score++
      return { s, score }
    })
    .sort((a, b) => b.score - a.score)
  const bullets = scored.slice(0, 3).map(x => x.s).filter(Boolean)
  while (bullets.length < 3 && sentences.length > bullets.length) {
    const s = sentences[bullets.length]
    if (s && !bullets.includes(s)) bullets.push(s)
  }

  // Naive sentiment
  const pos = /\b(thanks|great|awesome|excellent|love|happy|gracias|excelente|genial|feliz|perfecto)\b/i
  const neg = /\b(angry|upset|bad|terrible|hate|issue|problem|complaint|molesto|problema|queja|mal)\b/i
  const sentiment: SummaryResult['sentiment'] = neg.test(clean)
    ? 'negative'
    : pos.test(clean)
      ? 'positive'
      : 'neutral'

  return {
    summary: summary || `(${type}) No content`,
    bullets: bullets.length ? bullets : [summary],
    sentiment,
    provider: 'fallback',
  }
}

async function openAISummary(text: string, type: SummaryType): Promise<SummaryResult | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const system = `Summarize this ${type} in 2 sentences and 3 bullet points. Respond in the same language as the input. Return JSON only: {"summary":"...","bullets":["...","...","..."],"sentiment":"positive|neutral|negative"}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text.slice(0, 12_000) },
        ],
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    return {
      summary: String(parsed.summary || ''),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 5) : [],
      sentiment: parsed.sentiment,
      provider: 'openai',
    }
  } catch {
    return null
  }
}

export async function summarizeText(
  text: string,
  type: SummaryType,
): Promise<SummaryResult> {
  const key = `${type}:${hash(text)}`
  const cached = CACHE.get(key)
  if (cached) return cached

  let result: SummaryResult | null = null
  if (isOpenAIConfigured()) {
    result = await openAISummary(text, type)
  }
  if (!result) {
    result = deterministicSummary(text, type)
  }

  if (CACHE.size >= MAX_CACHE) {
    const firstKey = CACHE.keys().next().value
    if (firstKey) CACHE.delete(firstKey)
  }
  CACHE.set(key, result)
  return result
}
