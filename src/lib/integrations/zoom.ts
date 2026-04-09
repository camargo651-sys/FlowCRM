/**
 * Zoom integration — create meetings via Zoom REST API.
 */

interface ZoomMeetingInput {
  topic: string
  duration?: number // minutes
  startTime?: string // ISO 8601
  timezone?: string
}

interface ZoomMeetingResult {
  success: boolean
  join_url?: string
  meeting_id?: number
  error?: string
}

export async function createZoomMeeting(
  accessToken: string,
  input: ZoomMeetingInput,
): Promise<ZoomMeetingResult> {
  try {
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: input.topic,
        type: input.startTime ? 2 : 1, // 2 = scheduled, 1 = instant
        start_time: input.startTime,
        duration: input.duration || 30,
        timezone: input.timezone || 'UTC',
        settings: {
          join_before_host: true,
          waiting_room: false,
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Zoom API ${res.status}: ${text}` }
    }

    const data = await res.json()
    return {
      success: true,
      join_url: data.join_url,
      meeting_id: data.id,
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error creating Zoom meeting',
    }
  }
}
