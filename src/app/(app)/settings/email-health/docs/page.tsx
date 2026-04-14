'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROVIDERS = [
  {
    id: 'sendgrid',
    name: 'SendGrid',
    logo: 'SG',
    panelPath: 'Settings → Mail Settings → Event Webhook',
    instructions: [
      'Log in to app.sendgrid.com.',
      'Open Settings → Mail Settings → Event Webhook.',
      'Enable "Event Webhook" and paste the URL below into "HTTP Post URL".',
      'Select events: Delivered, Bounced, Dropped, Spam Reports, Unsubscribed (Opens/Clicks are optional).',
      'Click Save.',
    ],
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    logo: 'MG',
    panelPath: 'Sending → Webhooks',
    instructions: [
      'Log in to app.mailgun.com.',
      'Open Sending → Webhooks for your sending domain.',
      'Create a webhook for each event type (delivered, permanent_fail, temporary_fail, complained) pasting the URL below.',
      'Click Save.',
    ],
  },
  {
    id: 'postmark',
    name: 'Postmark',
    logo: 'PM',
    panelPath: 'Servers → Your Server → Default Message Stream → Webhooks',
    instructions: [
      'Log in to account.postmarkapp.com.',
      'Open your Server → Default Message Stream → Webhooks → Add Webhook.',
      'Paste the URL below into "Webhook URL".',
      'Enable: Delivery, Bounce, Spam Complaint, Open, Click, Subscription Change.',
      'Click Save Webhook.',
    ],
  },
]

export default function EmailHealthDocsPage() {
  const [origin, setOrigin] = useState('https://tracktio.app')
  const [secret, setSecret] = useState('YOUR_WEBHOOK_SECRET')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      // Generate a suggested random secret the user can paste into their integration config.
      const rnd = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      setSecret(rnd)
    }
  }, [])

  const copyUrl = async (provider: string) => {
    const url = `${origin}/api/webhooks/email/${provider}?secret=${secret}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(provider)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Mail className="w-5 h-5" /> ESP Webhook Setup
          </h1>
          <p className="page-subtitle">Forward delivery events from your email provider to Tracktio for real deliverability stats</p>
        </div>
        <Link href="/settings/email-health" className="btn-secondary btn-sm flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
      </div>

      <div className="card p-5 mb-6 bg-amber-50/50 border-amber-200 dark:bg-amber-500/5">
        <h3 className="text-sm font-semibold text-surface-900 mb-1">1. Save your webhook secret</h3>
        <p className="text-xs text-surface-600 mb-3">
          Paste this secret in the matching integration row (integrations.config.webhook_secret) for your workspace. The webhook URL below uses it to identify your workspace.
        </p>
        <code className="block text-xs font-mono p-2 rounded bg-white dark:bg-surface-900 border border-amber-200 break-all">
          {secret}
        </code>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(p => {
          const url = `${origin}/api/webhooks/email/${p.id}?secret=${secret}`
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                  {p.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-900 dark:text-surface-50">{p.name}</h3>
                  <p className="text-[11px] text-surface-500">{p.panelPath}</p>
                </div>
              </div>

              <div className="mb-3">
                <label className="label text-[11px]">Webhook URL</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={url}
                    className="input text-xs font-mono flex-1"
                    onFocus={e => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => copyUrl(p.id)}
                    className={cn('btn-secondary btn-sm flex items-center gap-1', copied === p.id && 'text-emerald-600')}
                  >
                    {copied === p.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === p.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <ol className="text-xs text-surface-600 dark:text-surface-400 space-y-1 list-decimal pl-4">
                {p.instructions.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )
        })}
      </div>

      <div className="card p-5 mt-6">
        <h3 className="text-sm font-semibold text-surface-900 mb-2">How it works</h3>
        <ul className="text-xs text-surface-600 dark:text-surface-400 space-y-1 list-disc pl-4">
          <li>Events are written to the <code>email_events</code> table.</li>
          <li>The Email Deliverability page aggregates the last 30 days to compute delivery, bounce, and complaint rates.</li>
          <li>Keep bounce rate &lt; 2% and complaint rate &lt; 0.1% to maintain sender reputation.</li>
        </ul>
      </div>
    </div>
  )
}
