'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Mail, FileText, DollarSign, Calendar, User, Send,
  MessageCircle, ChevronDown, ChevronUp, Edit2, X, Download,
  CreditCard, Copy, Clock, AlertTriangle, ExternalLink, ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { toast } from 'sonner'

interface InvoiceDetail {
  id: string; workspace_id: string; invoice_number: string; type: string; status: string
  contact_id: string | null; total: number; amount_paid: number; balance_due: number
  issue_date: string; due_date: string | null; currency: string; created_at: string
  subtotal?: number; tax_amount?: number; tax_rate?: number; discount?: number; notes?: string
  quote_id?: string | null
  contacts?: { id: string; name: string; email?: string; phone?: string } | null
}

interface InvoiceItem {
  id: string; description: string; quantity: number; unit_price: number; total: number; order_index: number
}

interface Payment {
  id: string; invoice_id: string; amount: number; method: string; date: string; created_at: string
}

interface ActivityRow {
  id: string; type: string; title: string; notes?: string
  due_date?: string; done: boolean; created_at: string
  user_id?: string
}

interface WhatsAppMessage {
  id: string; wamid: string; from_number: string; to_number: string
  direction: 'inbound' | 'outbound'; message_type: string
  body: string | null; status: string; received_at: string
}

interface EmailMessage {
  id: string; subject: string; snippet: string; from_address: string
  from_name: string; to_addresses: { email: string; name: string }[]
  direction: 'inbound' | 'outbound'; received_at: string
  is_read: boolean; thread_id: string
}

interface RelatedInvoice {
  id: string; invoice_number: string; total: number; status: string; issue_date: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green',
  partial: 'badge-yellow', overdue: 'badge-red', cancelled: 'badge-gray',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function daysUntilDue(dueDate: string | null): { label: string; overdue: boolean; days: number } {
  if (!dueDate) return { label: 'No due date', overdue: false, days: 0 }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: `${Math.abs(diffDays)} days overdue`, overdue: true, days: Math.abs(diffDays) }
  if (diffDays === 0) return { label: 'Due today', overdue: false, days: 0 }
  return { label: `Due in ${diffDays} days`, overdue: false, days: diffDays }
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [waMessages, setWaMessages] = useState<WhatsAppMessage[]>([])
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [relatedInvoices, setRelatedInvoices] = useState<RelatedInvoice[]>([])
  const [loading, setLoading] = useState(true)

  // Notes chat state
  const [noteText, setNoteText] = useState('')
  const [noteSending, setNoteSending] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)

  // WhatsApp collapsible
  const [waExpanded, setWaExpanded] = useState(true)
  const [waVisibleCount, setWaVisibleCount] = useState(30)
  const waEndRef = useRef<HTMLDivElement>(null)
  const waInputRef = useRef<HTMLInputElement>(null)

  // Email collapsible
  const [emailExpanded, setEmailExpanded] = useState(false)

  // WA send
  const [waSendText, setWaSendText] = useState('')
  const [waSending, setWaSending] = useState(false)

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'transfer', date: new Date().toISOString().split('T')[0] })
  const [paymentSaving, setPaymentSaving] = useState(false)

  // Profile map for note authors
  const [profileMap, setProfileMap] = useState<Record<string, string>>({})
  const [currentUserName, setCurrentUserName] = useState('You')

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load invoice with contact and items
    const [invRes, itemsRes] = await Promise.all([
      supabase.from('invoices').select('*, contacts(id, name, email, phone)').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('order_index'),
    ])

    if (!invRes.data) { setLoading(false); return }
    const inv: InvoiceDetail = invRes.data
    setInvoice(inv)
    setItems(itemsRes.data || [])

    // Load payments
    const { data: paymentsData } = await supabase.from('payments').select('*').eq('invoice_id', id).order('date', { ascending: false })
    setPayments(paymentsData || [])

    // Load contact-related data if we have a contact
    if (inv.contact_id) {
      const [activitiesRes, waRes, emailsRes, relatedRes] = await Promise.all([
        supabase.from('activities').select('*').eq('contact_id', inv.contact_id).order('created_at', { ascending: false }),
        supabase.from('whatsapp_messages')
          .select('id, wamid, from_number, to_number, direction, message_type, body, status, received_at')
          .eq('contact_id', inv.contact_id).order('received_at', { ascending: true }).limit(100),
        supabase.from('email_messages')
          .select('id, subject, snippet, from_address, from_name, to_addresses, direction, received_at, is_read, thread_id')
          .eq('contact_id', inv.contact_id).order('received_at', { ascending: false }).limit(50),
        supabase.from('invoices')
          .select('id, invoice_number, total, status, issue_date')
          .eq('contact_id', inv.contact_id).neq('id', id).order('created_at', { ascending: false }).limit(10),
      ])

      setActivities(activitiesRes.data || [])
      setWaMessages(waRes.data || [])
      setEmails(emailsRes.data || [])
      setRelatedInvoices(relatedRes.data || [])

      // Load profiles for note author names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('workspace_id', inv.workspace_id)
      if (profiles) {
        const map: Record<string, string> = {}
        profiles.forEach((p: { id: string; full_name?: string; email?: string }) => {
          map[p.id] = p.full_name || p.email || 'Unknown'
        })
        setProfileMap(map)
      }
    }

    // Current user name
    const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).single()
    if (profile) setCurrentUserName(profile.full_name || profile.email || 'You')

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Auto-scroll notes to bottom
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities])

  // Send note
  const sendNote = async () => {
    if (!noteText.trim() || !invoice || !invoice.contact_id) return
    setNoteSending(true)
    const { data } = await supabase.from('activities').insert([{
      workspace_id: invoice.workspace_id,
      contact_id: invoice.contact_id,
      type: 'note',
      title: noteText.trim(),
      notes: null,
      done: false,
    }]).select().single()
    if (data) setActivities(prev => [data, ...prev])
    setNoteText('')
    setNoteSending(false)
  }

  // Send WhatsApp
  const handleWaSend = async () => {
    if (!waSendText.trim() || !invoice?.contact_id) return
    setWaSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: invoice.contact_id, message: waSendText.trim() }),
      })
      if (res.ok) {
        const { message: stored } = await res.json()
        if (stored) setWaMessages(prev => [...prev, stored])
        setWaSendText('')
      }
    } catch { /* noop */ }
    setWaSending(false)
  }

  // Record payment
  const recordPayment = async () => {
    if (!invoice || paymentForm.amount <= 0) return
    setPaymentSaving(true)

    const ws = await getActiveWorkspace(supabase, (await supabase.auth.getUser()).data.user!.id, 'id')
    await supabase.from('payments').insert({
      invoice_id: invoice.id,
      workspace_id: ws?.id || invoice.workspace_id,
      amount: paymentForm.amount,
      method: paymentForm.method,
      date: paymentForm.date,
    })

    const newAmountPaid = (invoice.amount_paid || 0) + paymentForm.amount
    const newBalanceDue = Math.max(0, invoice.total - newAmountPaid)
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial'

    await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      balance_due: newBalanceDue,
      status: newStatus,
    }).eq('id', invoice.id)

    setPaymentSaving(false)
    setShowPaymentModal(false)
    setPaymentForm({ amount: 0, method: 'transfer', date: new Date().toISOString().split('T')[0] })
    toast.success(`Payment of ${formatCurrency(paymentForm.amount)} recorded`)
    load()
  }

  // Send reminder email
  const sendReminder = async () => {
    if (!invoice) return
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Reminder sent to ${invoice.contacts?.email || 'client'}`)
        load()
      } else {
        toast.error(data.error || 'Failed to send reminder')
      }
    } catch {
      toast.error('Failed to send reminder')
    }
  }

  // Payment link (Stripe)
  const openPaymentLink = async () => {
    if (!invoice) return
    try {
      const res = await fetch('/api/payments/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.open(data.url, '_blank')
      } else {
        toast.error(data.error || 'Failed to create payment link')
      }
    } catch {
      toast.error('Failed to create payment link')
    }
  }

  // Duplicate invoice
  const duplicateInvoice = async () => {
    if (!invoice) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return

    // Count existing invoices for numbering
    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('workspace_id', ws.id)
    const num = (count || 0) + 1

    const { data: newInv } = await supabase.from('invoices').insert({
      workspace_id: ws.id,
      invoice_number: `INV-${String(num).padStart(4, '0')}`,
      contact_id: invoice.contact_id,
      subtotal: invoice.subtotal || invoice.total,
      tax_rate: invoice.tax_rate || 0,
      tax_amount: invoice.tax_amount || 0,
      total: invoice.total,
      balance_due: invoice.total,
      due_date: invoice.due_date,
      notes: invoice.notes || null,
      status: 'draft',
      currency: invoice.currency,
    }).select('id').single()

    if (newInv && items.length) {
      await supabase.from('invoice_items').insert(
        items.map((item, i) => ({
          invoice_id: newInv.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          order_index: i,
        }))
      )
    }

    toast.success('Invoice duplicated')
    if (newInv) router.push(`/invoices/${newInv.id}`)
  }

  // Computed values
  const dueInfo = invoice ? daysUntilDue(invoice.due_date) : { label: '', overdue: false, days: 0 }

  // Notes (type='note'), sorted oldest first for chat view
  const noteActivities = activities
    .filter(a => a.type === 'note')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Visible WA messages
  const visibleWaMessages = waMessages.slice(Math.max(0, waMessages.length - waVisibleCount))
  const hasMoreWa = waMessages.length > waVisibleCount

  if (loading || !invoice) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button onClick={() => router.push('/invoices')} className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </button>

      {/* Mobile floating button to jump to interaction hub */}
      <button
        onClick={() => document.getElementById('interaction-hub')?.scrollIntoView({ behavior: 'smooth' })}
        className="lg:hidden fixed bottom-24 right-4 z-40 bg-brand-600 text-white rounded-2xl px-4 py-2.5 shadow-lg flex items-center gap-2 active:scale-95 transition-transform"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Chat</span>
      </button>

      {/* ====== TWO-COLUMN LAYOUT ====== */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ====== LEFT COLUMN (60%) ====== */}
        <div className="w-full lg:w-[60%] space-y-6">

          {/* Header card */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-surface-900 font-mono">{invoice.invoice_number}</h1>
                  <span className={cn('badge text-[10px]', STATUS_STYLES[invoice.status])}>{invoice.status}</span>
                </div>
                {invoice.contacts && (
                  <button onClick={() => router.push(`/contacts/${invoice.contacts!.id}`)}
                    className="text-sm text-brand-600 hover:underline mt-1 inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> {invoice.contacts.name}
                  </button>
                )}
                <div className="flex flex-wrap gap-4 mt-3">
                  <span className="flex items-center gap-1.5 text-xs text-surface-500">
                    <Calendar className="w-3.5 h-3.5" /> Issued: {invoice.issue_date || '—'}
                  </span>
                  {invoice.due_date && (
                    <span className={cn('flex items-center gap-1.5 text-xs', dueInfo.overdue ? 'text-red-600 font-semibold' : 'text-surface-500')}>
                      <Clock className="w-3.5 h-3.5" /> Due: {invoice.due_date}
                    </span>
                  )}
                </div>
              </div>
              {invoice.status === 'draft' && (
                <button onClick={() => router.push('/invoices')} className="btn-secondary btn-sm flex-shrink-0">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>
          </div>

          {/* KPI Stats bar */}
          <div className="card p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-surface-900">{formatCurrency(invoice.total)}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Total Amount</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(invoice.amount_paid || 0)}</p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Amount Paid</p>
              </div>
              <div className="text-center">
                <p className={cn('text-lg font-bold', dueInfo.overdue && invoice.balance_due > 0 ? 'text-red-600' : 'text-amber-600')}>
                  {formatCurrency(invoice.balance_due)}
                </p>
                <p className="text-[10px] text-surface-400 font-semibold uppercase">Balance Due</p>
              </div>
              <div className="text-center">
                {dueInfo.overdue ? (
                  <p className="text-lg font-bold text-red-600 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {dueInfo.days}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-surface-700">{dueInfo.days || '—'}</p>
                )}
                <p className="text-[10px] text-surface-400 font-semibold uppercase">
                  {dueInfo.overdue ? 'Days Overdue' : 'Days Until Due'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions bar */}
          <div className="flex flex-wrap gap-2">
            {['sent', 'partial', 'overdue'].includes(invoice.status) && (
              <button onClick={() => { setShowPaymentModal(true); setPaymentForm({ amount: invoice.balance_due, method: 'transfer', date: new Date().toISOString().split('T')[0] }) }}
                className="btn-sm bg-emerald-600 text-white rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium hover:bg-emerald-700 transition-colors">
                <DollarSign className="w-3.5 h-3.5" /> Record Payment
              </button>
            )}
            {invoice.contacts?.email && ['sent', 'partial', 'overdue'].includes(invoice.status) && (
              <button onClick={sendReminder} className="btn-secondary btn-sm">
                <Send className="w-3.5 h-3.5" /> Send Reminder
              </button>
            )}
            {invoice.contacts?.phone && (
              <button onClick={() => { setWaExpanded(true); setTimeout(() => waInputRef.current?.focus(), 100) }}
                className="btn-secondary btn-sm">
                <MessageCircle className="w-3.5 h-3.5" /> Send WhatsApp
              </button>
            )}
            {invoice.balance_due > 0 && ['sent', 'partial', 'overdue'].includes(invoice.status) && (
              <button onClick={openPaymentLink} className="btn-secondary btn-sm">
                <CreditCard className="w-3.5 h-3.5" /> Payment Link
              </button>
            )}
            <a href={`/api/pdf?type=invoice&id=${invoice.id}`} target="_blank" className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </a>
            <button onClick={duplicateInvoice} className="btn-secondary btn-sm">
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
          </div>

          {/* Line items table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                <FileText className="w-3.5 h-3.5 inline mr-1" /> Line Items ({items.length})
              </h3>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-surface-400 py-8 text-center">No line items</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-surface-100">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-surface-500 uppercase">Description</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-surface-500 uppercase w-16">Qty</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-surface-500 uppercase w-24">Price</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-surface-500 uppercase w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-surface-50">
                      <td className="px-4 py-3 text-sm text-surface-800">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-surface-600 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-surface-600 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-surface-800 text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Totals section */}
          <div className="card p-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-500">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(invoice.subtotal || invoice.total)}</span>
                </div>
                {(invoice.tax_rate != null && invoice.tax_rate > 0) && (
                  <div className="flex justify-between">
                    <span className="text-surface-500">Tax ({invoice.tax_rate}%)</span>
                    <span className="font-semibold">{formatCurrency(invoice.tax_amount || 0)}</span>
                  </div>
                )}
                {(invoice.discount != null && invoice.discount > 0) && (
                  <div className="flex justify-between">
                    <span className="text-surface-500">Discount</span>
                    <span className="font-semibold text-red-600">-{formatCurrency(invoice.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-surface-100 pt-1.5">
                  <span className="font-bold text-surface-900">Total</span>
                  <span className="font-bold text-brand-600">{formatCurrency(invoice.total)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-surface-500">Amount Paid</span>
                      <span className="font-semibold text-emerald-600">-{formatCurrency(invoice.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between border-t border-surface-100 pt-1.5">
                      <span className="font-bold text-surface-900">Balance Due</span>
                      <span className={cn('font-bold', dueInfo.overdue ? 'text-red-600' : 'text-amber-600')}>{formatCurrency(invoice.balance_due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Payment history */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              <DollarSign className="w-3.5 h-3.5 inline mr-1" /> Payment History ({payments.length})
            </h3>
            {payments.length === 0 ? (
              <p className="text-sm text-surface-400 py-4 text-center">No payments recorded</p>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">{formatCurrency(p.amount)}</p>
                        <p className="text-[10px] text-surface-400">{p.date}</p>
                      </div>
                    </div>
                    <span className="badge badge-gray text-[10px]">{p.method}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related records */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-3">
              <ExternalLink className="w-3.5 h-3.5 inline mr-1" /> Related Records
            </h3>
            <div className="space-y-3">
              {/* Contact link */}
              {invoice.contacts && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-surface-500 w-16 flex-shrink-0">Contact</span>
                  <button onClick={() => router.push(`/contacts/${invoice.contacts!.id}`)}
                    className="text-sm text-brand-600 hover:underline font-medium">
                    {invoice.contacts.name}
                  </button>
                </div>
              )}

              {/* Linked quote */}
              {invoice.quote_id && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-surface-500 w-16 flex-shrink-0">Quote</span>
                  <button onClick={() => router.push(`/quotes?edit=${invoice.quote_id}`)}
                    className="text-sm text-brand-600 hover:underline font-medium">
                    View linked quote
                  </button>
                </div>
              )}

              {/* Other invoices from same contact */}
              {relatedInvoices.length > 0 && (
                <div>
                  <p className="text-xs text-surface-500 mb-2">Other invoices from this contact</p>
                  <div className="space-y-1.5">
                    {relatedInvoices.map(ri => (
                      <div key={ri.id} onClick={() => router.push(`/invoices/${ri.id}`)}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-50 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-800 font-mono">{ri.invoice_number}</p>
                          <p className="text-[10px] text-surface-400">{ri.issue_date}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs font-semibold text-surface-700">{formatCurrency(ri.total)}</span>
                          <span className={cn('badge text-[9px]', STATUS_STYLES[ri.status])}>{ri.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!invoice.contacts && !invoice.quote_id && relatedInvoices.length === 0 && (
                <p className="text-sm text-surface-400 py-2 text-center">No related records</p>
              )}
            </div>
          </div>

          {/* Notes/internal notes */}
          {invoice.notes && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">
                <FileText className="w-3.5 h-3.5 inline mr-1" /> Invoice Notes
              </h3>
              <p className="text-sm text-surface-600 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}

        </div>
        {/* END LEFT COLUMN */}

        {/* ====== RIGHT COLUMN (40%) - Sticky Interaction Hub ====== */}
        <div id="interaction-hub" className="w-full lg:w-[40%]">
          <div className="lg:sticky lg:top-4 space-y-4">

            {/* Notes Chat Feed */}
            <div className="card overflow-hidden flex flex-col" style={{ maxHeight: '50vh' }}>
              <div className="px-4 py-3 border-b border-surface-100 bg-surface-50 flex-shrink-0">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 inline mr-1" /> Notes ({noteActivities.length})
                </h3>
              </div>

              {/* Chat messages area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
                {!invoice.contact_id ? (
                  <p className="text-sm text-surface-400 text-center py-8">No contact linked to this invoice.</p>
                ) : noteActivities.length === 0 ? (
                  <p className="text-sm text-surface-400 text-center py-8">No notes yet. Start the conversation.</p>
                ) : (
                  noteActivities.map(note => {
                    const authorName = note.user_id ? (profileMap[note.user_id] || currentUserName) : currentUserName
                    return (
                      <div key={note.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3 h-3 text-surface-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-3 py-2">
                            <p className="text-sm text-surface-800 whitespace-pre-wrap">{note.title}</p>
                            {note.notes && <p className="text-xs text-surface-500 mt-1">{note.notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 px-1">
                            <span className="text-[10px] text-surface-400 font-medium">{authorName}</span>
                            <span className="text-[10px] text-surface-300">{timeAgo(note.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={notesEndRef} />
              </div>

              {/* Note input */}
              {invoice.contact_id && (
                <div className="p-3 border-t border-surface-100 bg-surface-50 flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && noteText.trim()) {
                        e.preventDefault()
                        sendNote()
                      }
                    }}
                  />
                  <button onClick={sendNote} disabled={noteSending || !noteText.trim()}
                    className="btn-primary btn-sm px-3">
                    {noteSending
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>

            {/* WhatsApp Chat (collapsible) */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setWaExpanded(!waExpanded)}
                className="w-full px-4 py-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between hover:bg-surface-100 transition-colors">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-green-600" /> WhatsApp ({waMessages.length} messages)
                </h3>
                {waExpanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
              </button>

              {waExpanded && (
                <>
                  {waMessages.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No WhatsApp messages</p>
                      {invoice.contacts?.phone && (
                        <button onClick={() => waInputRef.current?.focus()}
                          className="btn-primary btn-sm mt-3" style={{ backgroundColor: '#25D366' }}>
                          <Send className="w-3.5 h-3.5" /> Start conversation
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="p-4 space-y-2.5 overflow-y-auto" style={{ maxHeight: '40vh' }}>
                        {hasMoreWa && (
                          <button
                            onClick={() => setWaVisibleCount(prev => prev + 30)}
                            className="text-xs text-brand-600 hover:underline font-medium w-full text-center py-1">
                            Load more messages
                          </button>
                        )}
                        {visibleWaMessages.map(msg => (
                          <div key={msg.id} className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}>
                            <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 shadow-sm',
                              msg.direction === 'outbound'
                                ? 'bg-[#DCF8C6] rounded-tr-sm'
                                : 'bg-white border border-surface-100 rounded-tl-sm')}>
                              <p className="text-sm text-surface-800 whitespace-pre-wrap">{msg.body || `[${msg.message_type}]`}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                <span className="text-[10px] text-surface-400">
                                  {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {msg.direction === 'outbound' && (
                                  <span className={cn('text-[10px]',
                                    msg.status === 'read' ? 'text-blue-500' :
                                    msg.status === 'delivered' ? 'text-surface-400' : 'text-surface-300')}>
                                    {msg.status === 'read' ? '\u2713\u2713' : msg.status === 'delivered' ? '\u2713\u2713' : msg.status === 'failed' ? '!' : '\u2713'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={waEndRef} />
                      </div>

                      {/* Send WA message */}
                      {invoice.contacts?.phone && (
                        <div className="p-3 border-t border-surface-100 bg-surface-50 flex gap-2">
                          <input
                            ref={waInputRef}
                            type="text"
                            className="input flex-1"
                            placeholder="Type a message..."
                            value={waSendText}
                            onChange={e => setWaSendText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey && waSendText.trim()) {
                                e.preventDefault()
                                handleWaSend()
                              }
                            }}
                          />
                          <button onClick={handleWaSend} disabled={waSending || !waSendText.trim()}
                            className="btn-primary btn-sm px-3" style={{ backgroundColor: '#25D366' }}>
                            {waSending
                              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <Send className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Email History (collapsible) */}
            <div className="card overflow-hidden">
              <button
                onClick={() => setEmailExpanded(!emailExpanded)}
                className="w-full px-4 py-3 border-b border-surface-100 bg-surface-50 flex items-center justify-between hover:bg-surface-100 transition-colors">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-blue-600" /> Emails ({emails.length})
                </h3>
                {emailExpanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
              </button>

              {emailExpanded && (
                <div className="max-h-[40vh] overflow-y-auto">
                  {emails.length === 0 ? (
                    <div className="text-center py-6 px-4">
                      <Mail className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                      <p className="text-sm text-surface-500">No emails synced</p>
                      <p className="text-[10px] text-surface-400 mt-1">Connect Gmail or Outlook in Integrations</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {emails.map(email => (
                        <div key={email.id} className="px-4 py-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className={cn('w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                              email.direction === 'inbound' ? 'bg-blue-50' : 'bg-emerald-50')}>
                              {email.direction === 'inbound'
                                ? <ArrowDownLeft className="w-3 h-3 text-blue-600" />
                                : <ArrowUpRight className="w-3 h-3 text-emerald-600" />}
                            </div>
                            <p className="text-sm font-medium text-surface-800 truncate flex-1">{email.subject}</p>
                            <span className="text-[10px] text-surface-400 flex-shrink-0">{timeAgo(email.received_at)}</span>
                          </div>
                          {email.snippet && (
                            <p className="text-[11px] text-surface-400 mt-1 line-clamp-1 pl-7">{email.snippet}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
        {/* END RIGHT COLUMN */}

      </div>
      {/* END TWO-COLUMN LAYOUT */}

      {/* ====== PAYMENT MODAL ====== */}
      {showPaymentModal && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm">
            <div className="modal-header">
              <h2>Record Payment — {invoice.invoice_number}</h2>
              <button onClick={() => setShowPaymentModal(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Amount</label>
                <input type="number" className="input" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
                <p className="text-[10px] text-surface-400 mt-0.5">Balance due: {formatCurrency(invoice.balance_due)}</p>
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => setShowPaymentModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={recordPayment} disabled={paymentForm.amount <= 0 || paymentSaving} className="btn-primary flex-1">{paymentSaving ? 'Saving...' : 'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
