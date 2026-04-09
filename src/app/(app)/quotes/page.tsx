'use client'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, Send, CheckCircle2, XCircle, Clock, Eye, Trash2, X, DollarSign, Percent, Calendar, Save } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  total: number
  order_index: number
  product_id?: string | null
}

interface ProductOption {
  id: string
  name: string
  sku: string
  unit_price: number
  stock_quantity: number
}

interface Quote {
  id: string
  workspace_id: string
  deal_id?: string
  contact_id?: string
  quote_number: string
  title: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  currency: string
  subtotal: number
  discount_type: 'percent' | 'fixed'
  discount_value: number
  tax_rate: number
  tax_amount: number
  total: number
  notes?: string
  terms?: string
  valid_until?: string
  created_at: string
  updated_at: string
  contacts?: { name: string; email?: string } | null
  deals?: { title: string } | null
  items?: QuoteItem[]
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'badge-gray', icon: FileText },
  sent: { label: 'Sent', color: 'badge-blue', icon: Send },
  accepted: { label: 'Accepted', color: 'badge-green', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'badge-red', icon: XCircle },
  expired: { label: 'Expired', color: 'badge-yellow', icon: Clock },
}

// ==================== QUOTE EDITOR ====================
function QuoteEditor({ quote, contacts, deals, products, workspaceId, onClose, onSave }: {
  quote: Quote | null
  contacts: { id: string; name: string; email?: string }[]
  deals: { id: string; title: string; contact_id?: string }[]
  products: ProductOption[]
  workspaceId: string
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [title, setTitle] = useState(quote?.title || '')
  const [contactId, setContactId] = useState(quote?.contact_id || '')
  const [dealId, setDealId] = useState(quote?.deal_id || '')
  const [currency, setCurrency] = useState(quote?.currency || 'USD')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(quote?.discount_type || 'percent')
  const [discountValue, setDiscountValue] = useState(quote?.discount_value || 0)
  const [taxRate, setTaxRate] = useState(quote?.tax_rate || 0)
  const [notes, setNotes] = useState(quote?.notes || '')
  const [terms, setTerms] = useState(quote?.terms || 'Payment due within 30 days of acceptance.\nPrices valid for 30 days from the date of this quote.')
  const [validUntil, setValidUntil] = useState(quote?.valid_until || '')
  const [items, setItems] = useState<QuoteItem[]>(quote?.items || [])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'items' | 'preview'>('items')

  // Calculations
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const discountAmount = discountType === 'percent' ? subtotal * (discountValue / 100) : discountValue
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (taxRate / 100)
  const total = afterDiscount + taxAmount

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `temp-${Date.now()}`, description: '', quantity: 1, unit_price: 0, discount: 0, total: 0, order_index: prev.length, product_id: null,
    }])
  }

  const addFromProduct = (product: ProductOption) => {
    setItems(prev => [...prev, {
      id: `temp-${Date.now()}`, description: product.name, quantity: 1,
      unit_price: product.unit_price, discount: 0, total: product.unit_price,
      order_index: prev.length, product_id: product.id,
    }])
  }

  const updateItem = (id: string, field: string, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      const qty = field === 'quantity' ? Number(value) : updated.quantity
      const price = field === 'unit_price' ? Number(value) : updated.unit_price
      const disc = field === 'discount' ? Number(value) : updated.discount
      updated.total = qty * price * (1 - disc / 100)
      return updated
    }))
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id))

  const handleSave = async (newStatus?: string) => {
    setSaving(true)
    const quoteData = {
      workspace_id: workspaceId,
      title,
      contact_id: contactId || null,
      deal_id: dealId || null,
      currency,
      subtotal,
      discount_type: discountType,
      discount_value: discountValue,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      notes: notes || null,
      terms: terms || null,
      valid_until: validUntil || null,
      status: newStatus || quote?.status || 'draft',
      ...(newStatus === 'sent' ? { sent_at: new Date().toISOString() } : {}),
      ...(newStatus === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
    }

    let quoteId = quote?.id
    if (quoteId) {
      await supabase.from('quotes').update(quoteData).eq('id', quoteId)
      await supabase.from('quote_items').delete().eq('quote_id', quoteId)
    } else {
      const count = await supabase.from('quotes').select('id', { count: 'exact' }).eq('workspace_id', workspaceId)
      const num = (count.count || 0) + 1
      const viewToken = crypto.randomUUID()
      const { data } = await supabase.from('quotes').insert([{
        ...quoteData, quote_number: `Q-${String(num).padStart(4, '0')}`, view_token: viewToken,
      }]).select('id').single()
      quoteId = data?.id
    }

    if (quoteId && items.length > 0) {
      const itemsData = items.map((item, i) => ({
        quote_id: quoteId, description: item.description, quantity: item.quantity,
        unit_price: item.unit_price, discount: item.discount, total: item.total, order_index: i,
        product_id: item.product_id || null,
      }))
      await supabase.from('quote_items').insert(itemsData)
    }

    // Auto-deduct stock when quote is accepted
    if (newStatus === 'accepted' && quoteId) {
      for (const item of items) {
        if (!item.product_id) continue
        const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
        if (!product) continue
        const newStock = product.stock_quantity - item.quantity
        await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id)
        await supabase.from('stock_movements').insert({
          workspace_id: workspaceId,
          product_id: item.product_id,
          type: 'sale',
          quantity: item.quantity,
          previous_stock: product.stock_quantity,
          new_stock: newStock,
          reference: `Quote ${quote?.quote_number || ''}`,
          notes: `Auto-deducted from accepted quote: ${title}`,
        })
      }
    }

    setSaving(false)
    onSave()
    onClose()
  }

  const { template } = useWorkspace()

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-surface-900">{quote ? 'Edit Quote' : 'New Quote'}</h2>
            {quote && <p className="text-xs text-surface-400 mt-0.5">{quote.quote_number}</p>}
          </div>
          <div className="flex items-center gap-2">
            {quote?.status === 'draft' && (
              <button onClick={() => handleSave('sent')} className="btn-secondary btn-sm">
                <Send className="w-3.5 h-3.5" /> Mark as Sent
              </button>
            )}
            {quote?.status === 'sent' && (
              <>
                <button onClick={() => handleSave('accepted')} className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 font-medium rounded-lg px-3 py-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                </button>
                <button onClick={() => handleSave('rejected')} className="btn-sm bg-red-600 text-white hover:bg-red-700 inline-flex items-center gap-1.5 font-medium rounded-lg px-3 py-1.5 text-xs">
                  <XCircle className="w-3.5 h-3.5" /> Rejected
                </button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
              <X className="w-4 h-4 text-surface-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Quote Title *</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="e.g. Website Redesign Proposal" />
            </div>
            <div>
              <label className="label">{template.contactLabel.singular}</label>
              <select className="input" value={contactId} onChange={e => setContactId(e.target.value)}>
                <option value="">Select {template.contactLabel.singular.toLowerCase()}...</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{template.dealLabel.singular}</label>
              <select className="input" value={dealId} onChange={e => setDealId(e.target.value)}>
                <option value="">Select {template.dealLabel.singular.toLowerCase()}...</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                {['USD','EUR','GBP','MXN','COP','BRL','ARS','CLP','PEN'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input type="date" className="input" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-surface-100 rounded-xl w-fit">
            <button onClick={() => setActiveTab('items')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === 'items' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
              Line Items
            </button>
            <button onClick={() => setActiveTab('preview')} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', activeTab === 'preview' ? 'bg-white shadow-sm text-surface-900' : 'text-surface-500')}>
              Preview
            </button>
          </div>

          {/* Items tab */}
          {activeTab === 'items' && (
            <div>
              {/* Items header */}
              <div className="grid grid-cols-12 gap-2 px-2 mb-2">
                <span className="col-span-5 text-[10px] font-semibold text-surface-400 uppercase">Description</span>
                <span className="col-span-2 text-[10px] font-semibold text-surface-400 uppercase">Qty</span>
                <span className="col-span-2 text-[10px] font-semibold text-surface-400 uppercase">Unit Price</span>
                <span className="col-span-1 text-[10px] font-semibold text-surface-400 uppercase">Disc %</span>
                <span className="col-span-1 text-[10px] font-semibold text-surface-400 uppercase text-right">Total</span>
                <span className="col-span-1"></span>
              </div>

              <div className="space-y-2 mb-3">
                {items.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-surface-50 rounded-xl border border-surface-100">
                    <input className="col-span-5 input text-sm py-1.5" value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Product or service..." />
                    <input className="col-span-2 input text-sm py-1.5 text-center" type="number" min="0" step="0.01"
                      value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
                    <input className="col-span-2 input text-sm py-1.5 text-right" type="number" min="0" step="0.01"
                      value={item.unit_price || ''} onChange={e => updateItem(item.id, 'unit_price', e.target.value)} />
                    <input className="col-span-1 input text-sm py-1.5 text-center" type="number" min="0" max="100"
                      value={item.discount || ''} onChange={e => updateItem(item.id, 'discount', e.target.value)} />
                    <span className="col-span-1 text-sm font-semibold text-surface-700 text-right">
                      {formatCurrency(item.total)}
                    </span>
                    <button onClick={() => removeItem(item.id)} className="col-span-1 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500 mx-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={addItem} className="btn-ghost btn-sm flex-1 justify-center border border-dashed border-surface-200">
                  <Plus className="w-3.5 h-3.5" /> Add Line Item
                </button>
                {products.length > 0 && (
                  <div className="relative flex-1">
                    <select
                      className="input text-xs w-full"
                      value=""
                      onChange={e => {
                        const prod = products.find(p => p.id === e.target.value)
                        if (prod) addFromProduct(prod)
                      }}
                    >
                      <option value="">📦 Add from Inventory</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(p.unit_price)} ({p.stock_quantity} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="mt-6 flex justify-end">
                <div className="w-80 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500">Subtotal</span>
                    <span className="font-semibold text-surface-700">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-surface-500">Discount</span>
                    <div className="flex items-center gap-2">
                      <select className="input py-1 px-2 text-xs w-20" value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'fixed')}>
                        <option value="percent">%</option>
                        <option value="fixed">Fixed</option>
                      </select>
                      <input type="number" className="input py-1 px-2 text-xs w-20 text-right" min="0"
                        value={discountValue || ''} onChange={e => setDiscountValue(Number(e.target.value))} />
                      <span className="text-sm font-semibold text-red-500 w-24 text-right">-{formatCurrency(discountAmount)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-surface-500">Tax</span>
                    <div className="flex items-center gap-2">
                      <input type="number" className="input py-1 px-2 text-xs w-20 text-right" min="0" max="100"
                        value={taxRate || ''} onChange={e => setTaxRate(Number(e.target.value))} placeholder="%" />
                      <span className="text-sm font-semibold text-surface-700 w-24 text-right">{formatCurrency(taxAmount)}</span>
                    </div>
                  </div>
                  <div className="border-t border-surface-200 pt-3 flex justify-between">
                    <span className="font-bold text-surface-900">Total</span>
                    <span className="text-lg font-bold text-surface-900">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Additional notes for the client..." />
                </div>
                <div>
                  <label className="label">Terms & Conditions</label>
                  <textarea className="input resize-none" rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                    placeholder="Payment terms, conditions..." />
                </div>
              </div>
            </div>
          )}

          {/* Preview tab */}
          {activeTab === 'preview' && (
            <div className="bg-white border border-surface-200 rounded-xl p-8 max-w-2xl mx-auto shadow-sm">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-bold text-surface-900">{title || 'Untitled Quote'}</h3>
                  <p className="text-sm text-surface-400 mt-1">{quote?.quote_number || 'Q-0001'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-400">Date</p>
                  <p className="text-sm font-medium text-surface-700">{new Date().toLocaleDateString()}</p>
                  {validUntil && (
                    <>
                      <p className="text-xs text-surface-400 mt-2">Valid Until</p>
                      <p className="text-sm font-medium text-surface-700">{new Date(validUntil).toLocaleDateString()}</p>
                    </>
                  )}
                </div>
              </div>

              {contactId && (
                <div className="mb-6 p-4 bg-surface-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Bill To</p>
                  <p className="text-sm font-semibold text-surface-800">{contacts.find(c => c.id === contactId)?.name}</p>
                  <p className="text-xs text-surface-500">{contacts.find(c => c.id === contactId)?.email}</p>
                </div>
              )}

              {/* Items table */}
              <table className="w-full mb-6">
                <thead>
                  <tr className="border-b-2 border-surface-200">
                    <th className="text-left py-2 text-xs font-semibold text-surface-500 uppercase">Description</th>
                    <th className="text-center py-2 text-xs font-semibold text-surface-500 uppercase w-16">Qty</th>
                    <th className="text-right py-2 text-xs font-semibold text-surface-500 uppercase w-24">Price</th>
                    <th className="text-right py-2 text-xs font-semibold text-surface-500 uppercase w-24">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-surface-100">
                      <td className="py-3 text-sm text-surface-800">{item.description || '—'}</td>
                      <td className="py-3 text-sm text-surface-600 text-center">{item.quantity}</td>
                      <td className="py-3 text-sm text-surface-600 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 text-sm font-semibold text-surface-800 text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-surface-500">Discount</span><span className="text-red-500">-{formatCurrency(discountAmount)}</span></div>}
                  {taxAmount > 0 && <div className="flex justify-between text-sm"><span className="text-surface-500">Tax ({taxRate}%)</span><span>{formatCurrency(taxAmount)}</span></div>}
                  <div className="border-t-2 border-surface-900 pt-2 flex justify-between">
                    <span className="font-bold text-surface-900">Total</span>
                    <span className="text-lg font-bold text-surface-900">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {notes && (
                <div className="mt-6 p-4 bg-surface-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-surface-600 whitespace-pre-line">{notes}</p>
                </div>
              )}
              {terms && (
                <div className="mt-4 p-4 bg-surface-50 rounded-xl">
                  <p className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Terms & Conditions</p>
                  <p className="text-xs text-surface-500 whitespace-pre-line">{terms}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-surface-100 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSave()} disabled={saving || !title} className="btn-primary">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN PAGE ====================
export default function QuotesPage() {
  const supabase = createClient()
  const { template } = useWorkspace()
  const { t } = useI18n()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [contacts, setContacts] = useState<{ id: string; name: string; email?: string }[]>([])
  const [inventoryProducts, setInventoryProducts] = useState<ProductOption[]>([])
  const [deals, setDeals] = useState<{ id: string; title: string; contact_id?: string }[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)

    const [quotesRes, contactsRes, dealsRes, productsRes] = await Promise.all([
      supabase.from('quotes').select('*, contacts(name, email), deals(title)').eq('workspace_id', ws.id).order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name, email').eq('workspace_id', ws.id).order('name'),
      supabase.from('deals').select('id, title, contact_id').eq('workspace_id', ws.id).order('title'),
      supabase.from('products').select('id, name, sku, unit_price, stock_quantity').eq('workspace_id', ws.id).eq('status', 'active').order('name'),
    ])

    setQuotes(quotesRes.data || [])
    setContacts(contactsRes.data || [])
    setDeals(dealsRes.data || [])
    setInventoryProducts(productsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openEditor = async (quote: Quote) => {
    const { data: items } = await supabase.from('quote_items').select('*').eq('quote_id', quote.id).order('order_index')
    setEditingQuote({ ...quote, items: items || [] })
    setShowEditor(true)
  }

  const deleteQuote = async (id: string) => {
    await supabase.from('quote_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    setQuotes(prev => prev.filter(q => q.id !== id))
  }

  const filtered = quotes.filter(q => {
    if (filter !== 'all' && q.status !== filter) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !q.quote_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    total_value: quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0),
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.quotes')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{quotes.length} total · {formatCurrency(stats.total_value)} accepted</p>
        </div>
        <button onClick={() => { setEditingQuote(null); setShowEditor(true) }} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> New Quote
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Drafts', value: stats.draft, icon: FileText, color: 'text-surface-500', bg: 'bg-surface-50' },
          { label: 'Sent', value: stats.sent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Accepted', value: stats.accepted, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Revenue', value: formatCurrency(stats.total_value), icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-surface-900 mt-2">{value}</p>
            <p className="text-xs text-surface-500 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9 text-xs" placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {['all', 'draft', 'sent', 'accepted', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize',
                filter === f ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-100')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes list */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-surface-400" />
          </div>
          <p className="text-surface-600 font-medium mb-1">No quotes yet</p>
          <p className="text-surface-400 text-sm mb-4">Create your first quote to start sending proposals</p>
          <button onClick={() => { setEditingQuote(null); setShowEditor(true) }} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> New Quote
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Quote</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden md:table-cell">{template.contactLabel.singular}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-surface-500 uppercase hidden lg:table-cell">{template.dealLabel.singular}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Total</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-surface-500 uppercase">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(quote => {
                const statusCfg = STATUS_CONFIG[quote.status]
                return (
                  <tr key={quote.id} onClick={() => openEditor(quote)}
                    className="border-b border-surface-50 last:border-0 hover:bg-surface-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-surface-800">{quote.title}</p>
                      <p className="text-xs text-surface-400">{quote.quote_number} · {new Date(quote.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-surface-600">{quote.contacts?.name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-surface-600">{quote.deals?.title || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-bold text-surface-900">{formatCurrency(quote.total)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('badge text-[10px]', statusCfg.color)}>{statusCfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={e => { e.stopPropagation(); deleteQuote(quote.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-surface-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showEditor && (
        <QuoteEditor
          quote={editingQuote}
          contacts={contacts}
          deals={deals}
          products={inventoryProducts}
          workspaceId={workspaceId}
          onClose={() => { setShowEditor(false); setEditingQuote(null) }}
          onSave={load}
        />
      )}
    </div>
  )
}
