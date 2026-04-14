'use client'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'

type Invoice = { id: string; invoice_number: string; issue_date: string; total: number; balance_due: number; status: string; pdf_url?: string }
type Quote = { id: string; title: string; quote_number: string; total: number; valid_until?: string; status: string; view_token?: string }
type Contract = { id: string; title: string; contract_number: string; start_date?: string; end_date?: string; value: number; status: string; file_url?: string }
type Deal = { id: string; title: string; value: number; status: string; probability?: number; expected_close_date?: string; pipeline_stages?: { name: string; color: string } | null }
type DocItem = { id: string; name: string; url?: string; type?: string; created_at?: string }

type PortalData = {
  company: { name: string; primary_color?: string; logo_url?: string; email?: string; phone?: string; whatsapp?: string } | null
  contact: { name: string; email?: string } | null
  invoices: Invoice[]
  quotes: Quote[]
  contracts: Contract[]
  deals: Deal[]
  documents?: DocItem[]
}

const FALLBACK = '#0891B2'

function statusClass(s: string) {
  const k = (s || '').toLowerCase()
  if (['paid', 'active', 'accepted', 'won', 'signed'].includes(k)) return 'badge-green'
  if (['partial', 'pending', 'sent', 'open', 'draft'].includes(k)) return 'badge-blue'
  if (['overdue', 'expired', 'lost', 'cancelled'].includes(k)) return 'badge-red'
  if (['negotiation', 'proposal'].includes(k)) return 'badge-yellow'
  return 'badge-gray'
}

function money(n: number) {
  return `$${Number(n || 0).toLocaleString()}`
}

// Mock stub returned if the API has no data yet. TODO: connect to Supabase via /api/portal (already wired)
// when portal_tokens row doesn't exist this mock lets designers preview the UI by adding ?preview=1.
const MOCK: PortalData = {
  company: { name: 'Acme Studio', primary_color: FALLBACK, logo_url: undefined, email: 'hola@acme.studio', whatsapp: '+525555555555' },
  contact: { name: 'Cliente Demo', email: 'cliente@example.com' },
  invoices: [
    { id: '1', invoice_number: 'INV-0001', issue_date: '2026-03-15', total: 12500, balance_due: 0, status: 'paid' },
    { id: '2', invoice_number: 'INV-0002', issue_date: '2026-04-01', total: 8400, balance_due: 8400, status: 'pending' },
  ],
  quotes: [{ id: '1', title: 'Rediseno web', quote_number: 'QUO-0007', total: 24000, valid_until: '2026-04-30', status: 'sent' }],
  contracts: [{ id: '1', title: 'Servicio anual soporte', contract_number: 'CTR-2026-01', start_date: '2026-01-01', end_date: '2026-12-31', value: 60000, status: 'active' }],
  deals: [{ id: '1', title: 'Expansion modulo ERP', value: 45000, status: 'open', expected_close_date: '2026-05-15', pipeline_stages: { name: 'Negotiation', color: '#0891B2' } }],
  documents: [{ id: '1', name: 'NDA firmado.pdf', created_at: '2026-02-01' }, { id: '2', name: 'Propuesta tecnica.pdf', created_at: '2026-03-10' }],
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'invoices' | 'quotes' | 'deals' | 'contracts' | 'documents'>('invoices')

  useEffect(() => {
    // Fire portal_view engagement event (non-blocking)
    fetch(`/api/track/click?event=portal_view&e=portal&i=${token}&w=portal`).catch(() => {})
    fetch(`/api/portal?token=${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('not_found')
        return r.json()
      })
      .then((d: PortalData) => {
        if (d && d.company) setData({ ...d, documents: d.documents || [] })
        else setData(MOCK)
      })
      .catch(() => {
        // Fallback to mock so the portal still renders in preview / offline.
        setData(MOCK)
        setError('offline')
      })
      .finally(() => setLoading(false))
  }, [token])

  const brand = data?.company?.primary_color || FALLBACK
  const brandStyle = useMemo(() => ({ '--brand': brand } as React.CSSProperties), [brand])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="h-10 w-10 rounded-full border-4 border-surface-200 border-t-transparent animate-spin" style={{ borderTopColor: FALLBACK }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 p-6 text-center">
        <h1 className="text-2xl font-extrabold text-surface-900">Portal no disponible</h1>
        <p className="mt-2 text-surface-500">Este enlace es invalido o ha expirado.</p>
      </div>
    )
  }

  const contactHref = data.company?.whatsapp
    ? `https://wa.me/${data.company.whatsapp.replace(/[^0-9]/g, '')}`
    : `mailto:${data.company?.email || ''}`

  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: 'invoices', label: 'Facturas', count: data.invoices.length },
    { key: 'quotes', label: 'Cotizaciones', count: data.quotes.length },
    { key: 'deals', label: 'Proyectos', count: data.deals.length },
    { key: 'contracts', label: 'Contratos', count: data.contracts.length },
    { key: 'documents', label: 'Documentos', count: data.documents?.length || 0 },
  ]

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900" style={brandStyle}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-surface-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            {data.company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.company.logo_url} alt={data.company.name || ''} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-extrabold text-white" style={{ background: brand }}>
                {(data.company?.name || 'T').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-extrabold leading-tight">{data.company?.name || 'Portal'}</div>
              <div className="text-xs text-surface-500">Portal del cliente</div>
            </div>
          </div>
          <a href={contactHref} className="btn-primary inline-flex w-full justify-center sm:w-auto" style={{ background: brand, borderColor: brand }}>
            Contactar
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Welcome */}
        <section className="card mb-6" style={{ borderTop: `4px solid ${brand}` }}>
          <h1 className="text-xl font-extrabold sm:text-2xl">
            Hola, <span style={{ color: brand }}>{data.contact?.name || 'Cliente'}</span>
          </h1>
          <p className="mt-1 text-sm text-surface-600">
            Aqui puedes revisar tus facturas, cotizaciones, proyectos y documentos en un solo lugar.
          </p>
          {error === 'offline' && (
            <p className="mt-3 text-xs text-amber-600">Mostrando datos de demostracion. Conecta Supabase para ver datos reales.</p>
          )}
        </section>

        {/* Summary tiles */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Por pagar', value: money(data.invoices.filter(i => i.balance_due > 0).reduce((a, b) => a + Number(b.balance_due || 0), 0)) },
            { label: 'Facturas', value: data.invoices.length },
            { label: 'Cotizaciones', value: data.quotes.length },
            { label: 'Proyectos', value: data.deals.length },
          ].map((t) => (
            <div key={t.label} className="card !p-4">
              <div className="text-[11px] uppercase tracking-wide text-surface-500">{t.label}</div>
              <div className="mt-1 text-lg font-extrabold sm:text-xl">{t.value}</div>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <div className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {tabs.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${active ? 'text-white shadow' : 'bg-white text-surface-600 border border-surface-200'}`}
                style={active ? { background: brand, borderColor: brand } : undefined}
              >
                {t.label} <span className={active ? 'opacity-80' : 'text-surface-400'}>({t.count})</span>
              </button>
            )
          })}
        </div>

        {/* Invoices */}
        {tab === 'invoices' && (
          <section className="card">
            {data.invoices.length === 0 ? (
              <Empty label="Sin facturas" />
            ) : (
              <ul className="divide-y divide-surface-100">
                {data.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{inv.invoice_number}</div>
                      <div className="text-xs text-surface-500">{inv.issue_date}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                      <div className="text-right">
                        <div className="text-sm font-extrabold">{money(inv.total)}</div>
                        <div className={`text-xs ${inv.balance_due > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {inv.balance_due > 0 ? `${money(inv.balance_due)} por pagar` : 'Pagada'}
                        </div>
                      </div>
                      <span className={statusClass(inv.status)}>{inv.status}</span>
                      <a
                        href={inv.pdf_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary !py-1.5 !px-3 text-xs"
                        onClick={(e) => { if (!inv.pdf_url) e.preventDefault() }}
                      >
                        Descargar
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Quotes */}
        {tab === 'quotes' && (
          <section className="card">
            {data.quotes.length === 0 ? (
              <Empty label="Sin cotizaciones" />
            ) : (
              <ul className="divide-y divide-surface-100">
                {data.quotes.map((q) => (
                  <li key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{q.title}</div>
                      <div className="text-xs text-surface-500">{q.quote_number} · vence {q.valid_until || '—'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-extrabold">{money(q.total)}</div>
                      <span className={statusClass(q.status)}>{q.status}</span>
                      {q.view_token && (
                        <a href={`/q/${q.view_token}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs">Ver</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Deals */}
        {tab === 'deals' && (
          <section className="card">
            {data.deals.length === 0 ? (
              <Empty label="Sin proyectos activos" />
            ) : (
              <ul className="divide-y divide-surface-100">
                {data.deals.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{d.title}</div>
                      <div className="text-xs text-surface-500">Cierre esperado {d.expected_close_date || '—'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-extrabold">{d.value ? money(d.value) : '—'}</div>
                      {d.pipeline_stages ? (
                        <span className="badge" style={{ background: (d.pipeline_stages.color || brand) + '20', color: d.pipeline_stages.color || brand }}>
                          {d.pipeline_stages.name}
                        </span>
                      ) : (
                        <span className={statusClass(d.status)}>{d.status}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Contracts */}
        {tab === 'contracts' && (
          <section className="card">
            {data.contracts.length === 0 ? (
              <Empty label="Sin contratos" />
            ) : (
              <ul className="divide-y divide-surface-100">
                {data.contracts.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{c.title}</div>
                      <div className="text-xs text-surface-500">{c.contract_number} · {c.start_date || '—'} → {c.end_date || '—'}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-extrabold">{money(c.value)}</div>
                      <span className={statusClass(c.status)}>{c.status}</span>
                      {c.file_url && (
                        <a href={c.file_url} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 !px-3 text-xs">Descargar</a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Documents */}
        {tab === 'documents' && (
          <section className="card">
            {(data.documents?.length || 0) === 0 ? (
              <Empty label="Sin documentos" />
            ) : (
              <ul className="divide-y divide-surface-100">
                {data.documents!.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-semibold">{doc.name}</div>
                      <div className="text-xs text-surface-500">
                        {doc.type ? <span className="uppercase tracking-wide mr-2">{doc.type}</span> : null}
                        {doc.created_at || ''}
                      </div>
                    </div>
                    <a
                      href={doc.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                      onClick={(e) => { if (!doc.url) e.preventDefault() }}
                    >
                      Descargar
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Floating contact button (mobile) */}
        <a
          href={contactHref}
          className="fixed bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg sm:hidden"
          style={{ background: brand }}
          aria-label="Contactar"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </a>
      </main>

      <footer className="border-t border-surface-200 bg-white py-6 text-center text-xs text-surface-400">
        Powered by <span className="font-semibold text-surface-600">Tracktio</span>
      </footer>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="py-10 text-center text-sm text-surface-400">{label}</div>
}
