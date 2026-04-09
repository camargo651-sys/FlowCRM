'use client'
import { useState } from 'react'
import { Mail, Send, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EmailComposerProps {
  contactId: string
  contactEmail: string
  contactName: string
  replyTo?: { subject: string; messageId?: string }
  onSent?: () => void
  onClose?: () => void
}

export default function EmailComposer({ contactId, contactEmail, contactName, replyTo, onSent, onClose }: EmailComposerProps) {
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Please fill in the subject and body')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactEmail,
          subject: subject.trim(),
          body: body.trim(),
          contactId,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Email sent to ${contactName}`)
        setSubject('')
        setBody('')
        onSent?.()
        onClose?.()
      } else {
        toast.error(data.error || 'Failed to send email')
      }
    } catch {
      toast.error('Failed to send email. Check your connection.')
    }
    setSending(false)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-surface-900">Compose Email</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 transition-colors">
            <X className="w-4 h-4 text-surface-400" />
          </button>
        )}
      </div>

      <div>
        <label className="label">To</label>
        <input
          className="input bg-surface-50 text-surface-500"
          value={`${contactName} <${contactEmail}>`}
          readOnly
        />
      </div>

      <div>
        <label className="label">Subject</label>
        <input
          className="input"
          placeholder="Email subject..."
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Body</label>
        <textarea
          className="input min-h-[160px] text-sm"
          placeholder="Write your message..."
          value={body}
          onChange={e => setBody(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onClose && (
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !subject.trim() || !body.trim()}
          className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {sending ? 'Sending...' : 'Send Email'}
        </button>
      </div>
    </div>
  )
}
