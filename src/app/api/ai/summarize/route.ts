import { NextRequest, NextResponse } from 'next/server'
import { summarizeText, isOpenAIConfigured, type SummaryType } from '@/lib/ai/summarize'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const text: string = (body?.text || '').toString()
    const type: SummaryType = (body?.type || 'email') as SummaryType
    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    const result = await summarizeText(text, type)
    return NextResponse.json({
      ...result,
      configured: isOpenAIConfigured(),
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ configured: isOpenAIConfigured() })
}
