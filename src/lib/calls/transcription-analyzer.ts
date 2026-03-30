/**
 * Analyzes a call transcript using Claude AI to extract:
 * - Summary
 * - Sentiment
 * - Key topics
 * - Next actions
 */
export async function analyzeTranscript(transcript: string): Promise<{
  summary: string
  sentiment: 'positive' | 'neutral' | 'negative'
  key_topics: string[]
  next_actions: string[]
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      summary: transcript.slice(0, 200),
      sentiment: 'neutral',
      key_topics: [],
      next_actions: [],
    }
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Analyze this sales call transcript and return JSON only (no markdown):
{
  "summary": "2-3 sentence summary of the call",
  "sentiment": "positive|neutral|negative",
  "key_topics": ["topic1", "topic2"],
  "next_actions": ["action1", "action2"]
}

Transcript:
${transcript.slice(0, 5000)}`
        }],
      }),
    })

    if (!res.ok) return { summary: transcript.slice(0, 200), sentiment: 'neutral', key_topics: [], next_actions: [] }

    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr)
  } catch {
    return { summary: transcript.slice(0, 200), sentiment: 'neutral', key_topics: [], next_actions: [] }
  }
}
