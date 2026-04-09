import { NextResponse } from 'next/server'
import { sendSlackNotification } from '@/lib/integrations/slack'

export async function POST(request: Request) {
  try {
    const { webhookUrl } = await request.json()

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json({ error: 'Missing webhookUrl' }, { status: 400 })
    }

    const result = await sendSlackNotification(webhookUrl, {
      text: 'Tracktio connected! You\'ll receive sales notifications here.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Tracktio connected!* :tada:\nYou\'ll receive sales notifications here.',
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `Test message sent at ${new Date().toLocaleString()}` },
          ],
        },
      ],
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
