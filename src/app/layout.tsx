import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers/Providers'

export const metadata: Metadata = {
  title: { default: 'Tracktio — AI-Powered ERP', template: '%s | Tracktio' },
  description: 'The ERP that runs your entire business. CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce — all in one platform. Zero configuration.',
  manifest: '/manifest.json',
  themeColor: '#6172f3',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tracktio' },
  openGraph: {
    title: 'Tracktio — AI-Powered ERP',
    description: 'CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce. Zero configuration. Ready in 60 seconds.',
    type: 'website',
    siteName: 'Tracktio',
  },
  twitter: { card: 'summary_large_image', title: 'Tracktio — AI-Powered ERP', description: '27 modules. One platform. Zero configuration.' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
