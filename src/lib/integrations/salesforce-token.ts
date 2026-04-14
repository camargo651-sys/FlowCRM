/**
 * Salesforce OAuth token helpers.
 *
 * Salesforce access tokens typically expire after ~2 hours. This helper
 * transparently refreshes them using the stored refresh_token and updates
 * the `integrations` row so subsequent callers reuse the new token.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SFConfig {
  access_token?: string
  refresh_token?: string | null
  instance_url?: string
  expires_at?: string | number | null
  [key: string]: unknown
}

export interface IntegrationRow {
  id: string
  workspace_id: string
  key: string
  config: SFConfig
}

const REFRESH_SKEW_SECONDS = 5 * 60

function isTokenFresh(cfg: SFConfig): boolean {
  if (!cfg.expires_at) return false
  const exp =
    typeof cfg.expires_at === 'number'
      ? cfg.expires_at
      : new Date(cfg.expires_at).getTime() / 1000
  if (!isFinite(exp)) return false
  return exp > Date.now() / 1000 + REFRESH_SKEW_SECONDS
}

/**
 * Hit the Salesforce token endpoint with grant_type=refresh_token and persist
 * the new access_token + expires_at back onto the integrations row.
 */
export async function refreshSalesforceToken(
  supabase: SupabaseClient,
  row: IntegrationRow,
): Promise<{ access_token: string; instance_url: string }> {
  const clientId = process.env.SF_CLIENT_ID
  const clientSecret = process.env.SF_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Salesforce OAuth not configured (SF_CLIENT_ID/SF_CLIENT_SECRET missing)')
  }

  const cfg = row.config || {}
  if (!cfg.refresh_token) {
    throw new Error('No refresh_token stored for Salesforce integration')
  }

  const base = cfg.instance_url || 'https://login.salesforce.com'
  const tokenUrl = `${base}/services/oauth2/token`

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(cfg.refresh_token),
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Salesforce refresh failed: ${res.status} ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    access_token: string
    instance_url?: string
    issued_at?: string
  }

  const newInstance = json.instance_url || cfg.instance_url || base
  // Salesforce tokens default to ~2h. Be conservative and set 110 minutes.
  const expiresAt = Math.floor(Date.now() / 1000) + 110 * 60

  const newConfig: SFConfig = {
    ...cfg,
    access_token: json.access_token,
    instance_url: newInstance,
    expires_at: expiresAt,
  }

  await supabase
    .from('integrations')
    .update({ config: newConfig })
    .eq('id', row.id)

  // Mutate so callers holding this reference see the new token.
  row.config = newConfig

  return { access_token: json.access_token, instance_url: newInstance }
}

/**
 * Returns a valid (non-expired) Salesforce access_token + instance_url.
 * Refreshes via refresh_token when the stored token is stale or missing.
 */
export async function getValidSalesforceToken(
  supabase: SupabaseClient,
  row: IntegrationRow,
): Promise<{ access_token: string; instance_url: string }> {
  const cfg = row.config || {}
  if (cfg.access_token && cfg.instance_url && isTokenFresh(cfg)) {
    return { access_token: cfg.access_token, instance_url: cfg.instance_url }
  }
  return refreshSalesforceToken(supabase, row)
}
