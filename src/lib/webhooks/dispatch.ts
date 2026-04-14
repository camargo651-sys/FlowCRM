import crypto from 'crypto'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Dispatch an outbound webhook event to all matching endpoints for a workspace.
 * Fire-and-forget: callers should not await unless they need the result.
 */
export async function dispatchEvent(
  event: string,
  payload: Record<string, unknown>,
  workspaceId: string
): Promise<void> {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: hooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .contains('events', [event])

  if (!hooks || hooks.length === 0) return

  await Promise.all(hooks.map(async (hook) => {
    const body = JSON.stringify({ event, payload, timestamp: Date.now() })
    const signature = hook.secret
      ? 'sha256=' + crypto.createHmac('sha256', hook.secret).update(body).digest('hex')
      : ''

    let statusCode: number | null = null
    let responseBody = ''
    let failed = false
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tracktio-Event': event,
          ...(signature ? { 'X-Tracktio-Signature': signature } : {}),
        },
        body,
      })
      statusCode = res.status
      try { responseBody = (await res.text()).slice(0, 1000) } catch {}
      failed = !res.ok
    } catch (e) {
      failed = true
      responseBody = e instanceof Error ? e.message : String(e)
    }

    await supabase.from('webhook_deliveries').insert({
      webhook_id: hook.id,
      event,
      payload,
      status_code: statusCode,
      response_body: responseBody,
    })

    if (failed) {
      await supabase
        .from('webhooks')
        .update({ fail_count: (hook.fail_count || 0) + 1 })
        .eq('id', hook.id)
    } else {
      await supabase
        .from('webhooks')
        .update({ last_triggered_at: new Date().toISOString(), fail_count: 0 })
        .eq('id', hook.id)
    }
  }))
}
