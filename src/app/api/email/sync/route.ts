import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { syncGmailMessages } from '@/lib/email/gmail-sync'
import { syncOutlookMessages } from '@/lib/email/outlook-sync'
import { extractContactsAndStore } from '@/lib/email/contact-extractor'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase()

  // Auth: either user session or cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  let userId: string | null = null
  let workspaceId: string | null = null

  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // Cron-triggered: sync all active accounts (we'll iterate)
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    workspaceId = ws.id
  }

  // Fetch active email accounts
  let query = supabase.from('email_accounts').select('*').eq('status', 'active')
  if (workspaceId) query = query.eq('workspace_id', workspaceId)

  const { data: accounts, error: accErr } = await query
  if (accErr || !accounts?.length) {
    return NextResponse.json({ message: 'No active email accounts', synced: 0 })
  }

  const results = []

  const onTokenRefreshed = async (accountId: string, encryptedToken: string, expiresAt: Date) => {
    await supabase.from('email_accounts').update({
      access_token: encryptedToken,
      token_expires_at: expiresAt.toISOString(),
      status: 'active',
    }).eq('id', accountId)
  }

  for (const account of accounts) {
    // Create sync log entry
    const { data: logEntry } = await supabase.from('email_sync_log').insert({
      email_account_id: account.id,
      status: 'running',
    }).select('id').single()

    try {
      // Sync messages based on provider
      const syncResult = account.provider === 'gmail'
        ? await syncGmailMessages(account, onTokenRefreshed)
        : await syncOutlookMessages(account, onTokenRefreshed)

      // Extract contacts and store messages
      const extractResult = await extractContactsAndStore(
        supabase,
        syncResult.messages,
        account.id,
        account.email_address,
        account.workspace_id,
        account.user_id,
        account.provider,
      )

      // Update sync cursor and last_synced_at
      if (syncResult.newCursor) {
        await supabase.from('email_accounts').update({
          sync_cursor: syncResult.newCursor,
          last_synced_at: new Date().toISOString(),
        }).eq('id', account.id)
      } else {
        await supabase.from('email_accounts').update({
          last_synced_at: new Date().toISOString(),
        }).eq('id', account.id)
      }

      // Update sync log
      if (logEntry) {
        await supabase.from('email_sync_log').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          messages_synced: extractResult.messagesStored,
          contacts_created: extractResult.contactsCreated,
          contacts_updated: extractResult.contactsUpdated,
        }).eq('id', logEntry.id)
      }

      results.push({
        account: account.email_address,
        provider: account.provider,
        ...extractResult,
      })
    } catch (err: any) {
      console.error(`Email sync failed for ${account.email_address}:`, err.message)

      // Mark account as error if token refresh failed
      if (err.message.includes('token refresh failed')) {
        await supabase.from('email_accounts').update({ status: 'expired' }).eq('id', account.id)
      }

      // Update sync log
      if (logEntry) {
        await supabase.from('email_sync_log').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error: err.message.slice(0, 500),
        }).eq('id', logEntry.id)
      }

      results.push({
        account: account.email_address,
        provider: account.provider,
        error: err.message,
      })
    }
  }

  return NextResponse.json({ synced: results.length, results })
}
