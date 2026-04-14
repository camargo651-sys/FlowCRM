import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers/Providers'

export const metadata: Metadata = {
  title: { default: 'Tracktio — Built to close.', template: '%s | Tracktio' },
  description: 'The modular business platform for teams that sell. CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce — 27 modules, one AI-powered platform.',
  manifest: '/manifest.json',
  themeColor: '#0891B2',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tracktio' },
  openGraph: {
    title: 'Tracktio — Built to close.',
    description: 'The modular business platform for teams that sell. 27 modules, one AI-powered platform. Free to start.',
    type: 'website',
    siteName: 'Tracktio',
    // TODO: replace with dedicated 1200x630 /og-image.png (currently reusing the 512x512 app icon).
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'Tracktio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tracktio — AI-Powered ERP',
    description: 'Replace 10 tools with one AI-powered platform. 27 modules, ready in 60 seconds. Free to start.',
    // TODO: replace with dedicated 1200x630 /og-image.png
    images: ['/icon-512.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0891B2" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (isLocal) {
              // Never keep a SW on localhost — it causes stale cache + HTTPS upgrade bugs during dev.
              navigator.serviceWorker.getRegistrations().then(function(regs){
                regs.forEach(function(r){ r.unregister() });
              }).catch(function(){});
              if (window.caches) {
                caches.keys().then(function(keys){ keys.forEach(function(k){ caches.delete(k) }) }).catch(function(){});
              }
            } else {
              navigator.serviceWorker.register('/sw.js').catch(function(){});
            }
          }
        `}} />
      </body>
    </html>
  )
}
