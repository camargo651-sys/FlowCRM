import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers/Providers'

export const metadata: Metadata = {
  title: { default: 'Tracktio — Run your business, not your software', template: '%s | Tracktio' },
  description: 'AI-powered ERP with 27 modules: CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce. Replace 10 tools with one platform. Free to start.',
  manifest: '/manifest.json',
  themeColor: '#6172f3',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tracktio' },
  openGraph: {
    title: 'Tracktio — Run your business, not your software',
    description: '27 modules. One platform. Zero configuration. CRM, invoicing, inventory, HR, accounting, and more — powered by AI. Free to start.',
    type: 'website',
    siteName: 'Tracktio',
  },
  twitter: { card: 'summary_large_image', title: 'Tracktio — AI-Powered ERP', description: 'Replace 10 tools with one AI-powered platform. 27 modules, ready in 60 seconds. Free to start.' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6172f3" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {})
          }
        `}} />
      </body>
    </html>
  )
}
