/**
 * Lightweight analytics helper.
 *
 * Calls `window.gtag` (Google Analytics / GA4) and `window.fbq` (Facebook Pixel)
 * if available. Falls back to a no-op on server or when the providers are not
 * loaded, so call sites never need to guard.
 *
 * Providers are loaded via `src/components/shared/GoogleAnalytics.tsx` and
 * `FacebookPixel.tsx` (workspace-level integrations), or when the env vars
 * `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_FB_PIXEL_ID` are set and a script tag is
 * injected at the app root.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>

type Gtag = (...args: unknown[]) => void
type Fbq = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: Gtag
    fbq?: Fbq
    dataLayer?: unknown[]
  }
}

export function trackEvent(name: string, props: EventProps = {}): void {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, props)
    } else if (Array.isArray(window.dataLayer)) {
      // Queue for gtag if it loads later.
      window.dataLayer.push({ event: name, ...props })
    }
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', name, props)
    }
  } catch {
    // Analytics must never break the app.
  }
}

export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', { page_path: path })
    }
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView')
    }
  } catch {
    // swallow
  }
}
