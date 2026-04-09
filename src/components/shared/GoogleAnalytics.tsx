'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

/**
 * Google Analytics (gtag.js) component.
 * Loads the GA4 script if the google_analytics integration is enabled for the workspace.
 */
export default function GoogleAnalytics() {
  const [measurementId, setMeasurementId] = useState<string | null>(null)

  useEffect(() => {
    async function loadConfig() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const ws = await getActiveWorkspace(supabase, user.id, 'id')
        if (!ws) return

        const { data: integration } = await supabase
          .from('integrations')
          .select('config, enabled')
          .eq('workspace_id', ws.id)
          .eq('key', 'google_analytics')
          .eq('enabled', true)
          .single()

        if (integration) {
          const config = integration.config as Record<string, string>
          if (config.measurement_id) {
            setMeasurementId(config.measurement_id)
          }
        }
      } catch {
        // Silently fail — analytics is non-critical
      }
    }
    loadConfig()
  }, [])

  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  )
}
