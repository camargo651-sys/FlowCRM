'use client'
import { useEffect } from 'react'

export default function FetchDebugLogger() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as { __tracktio_fetch_patched?: boolean }
    if (w.__tracktio_fetch_patched) return
    w.__tracktio_fetch_patched = true
    const orig = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await orig(...args)
      if (res.status >= 400 && res.status < 500) {
        let url: string
        try {
          const first = args[0]
          url = typeof first === 'string' ? first : first instanceof URL ? first.toString() : (first as Request).url
        } catch {
          url = '<unknown>'
        }
        let body = ''
        try {
          body = await res.clone().text()
        } catch {}
        // eslint-disable-next-line no-console
        console.error(`[tracktio-debug] ${res.status} → ${url}`, body.slice(0, 500))
      }
      return res
    }
  }, [])
  return null
}
