'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

/**
 * Facebook Pixel component.
 * Loads the fbq script if the facebook_pixel integration is enabled for the workspace.
 */
export default function FacebookPixel() {
  const [pixelId, setPixelId] = useState<string | null>(null)

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
          .eq('key', 'facebook_pixel')
          .eq('enabled', true)
          .single()

        if (integration) {
          const config = integration.config as Record<string, string>
          if (config.pixel_id) {
            setPixelId(config.pixel_id)
          }
        }
      } catch {
        // Silently fail — tracking is non-critical
      }
    }
    loadConfig()
  }, [])

  if (!pixelId) return null

  return (
    <>
      <Script id="facebook-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
