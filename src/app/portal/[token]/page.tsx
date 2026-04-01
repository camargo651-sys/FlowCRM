'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function PortalPage() {
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'invoices'|'quotes'|'contracts'>('invoices')

  useEffect(() => {
    fetch(`/api/portal?token=${token}`).then(r => r.json()).then(d => {
      if (d.company) setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [token])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: '-apple-system, sans-serif' }}><div style={{ width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #6172f3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '80px 20px', fontFamily: '-apple-system, sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1e293b' }}>Portal not found</h1>
      <p style={{ color: '#64748b', marginTop: 8 }}>This link is invalid or has expired.</p>
    </div>
  )

  const color = data.company?.primary_color || '#6172f3'
  const STATUS_COLORS: Record<string, string> = {
    draft: '#94a3b8', sent: '#3b82f6', paid: '#10b981', partial: '#f59e0b',
    overdue: '#ef4444', active: '#10b981', expired: '#ef4444', accepted: '#10b981',
  }

  return (
    <div style={{ fontFamily: '-apple-system, sans-serif', color: '#1e293b', background: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data.company?.logo_url && <img src={data.company.logo_url} style={{ width: 32, height: 32, borderRadius: 8 }} />}
          <span style={{ fontWeight: 800, fontSize: 16 }}>{data.company?.name}</span>
        </div>
        <span style={{ fontSize: 13, color: '#64748b' }}>Welcome, {data.contact?.name}</span>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {[
            { key: 'invoices', label: `Invoices (${data.invoices.length})` },
            { key: 'quotes', label: `Proposals (${data.quotes.length})` },
            { key: 'contracts', label: `Contracts (${data.contracts.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1e293b' : '#64748b',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Invoices */}
        {tab === 'invoices' && (
          <div>
            {data.invoices.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No invoices</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Date</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Balance</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Status</th>
                </tr></thead>
                <tbody>
                  {data.invoices.map((inv: any) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{inv.invoice_number}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{inv.issue_date}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>${Number(inv.total).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: inv.balance_due > 0 ? '#f59e0b' : '#10b981' }}>${Number(inv.balance_due).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[inv.status] || '#94a3b8') + '20', color: STATUS_COLORS[inv.status] || '#94a3b8', textTransform: 'uppercase' }}>{inv.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Quotes */}
        {tab === 'quotes' && (
          <div>
            {data.quotes.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No proposals</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Proposal</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Total</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Valid Until</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Status</th>
                  <th style={{ padding: '8px 12px' }}></th>
                </tr></thead>
                <tbody>
                  {data.quotes.map((q: any) => (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}><div style={{ fontSize: 13, fontWeight: 600 }}>{q.title}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{q.quote_number}</div></td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>${Number(q.total).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{q.valid_until || '—'}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[q.status] || '#94a3b8') + '20', color: STATUS_COLORS[q.status] || '#94a3b8', textTransform: 'uppercase' }}>{q.status}</span></td>
                      <td style={{ padding: '10px 12px' }}>{q.view_token && <a href={`/q/${q.view_token}`} target="_blank" style={{ fontSize: 11, color, fontWeight: 600 }}>View</a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Contracts */}
        {tab === 'contracts' && (
          <div>
            {data.contracts.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>No contracts</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Contract</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Period</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Value</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#94a3b8' }}>Status</th>
                </tr></thead>
                <tbody>
                  {data.contracts.map((c: any) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px' }}><div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div><div style={{ fontSize: 10, color: '#94a3b8' }}>{c.contract_number}</div></td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>{c.start_date || '—'} → {c.end_date || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>${Number(c.value).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[c.status] || '#94a3b8') + '20', color: STATUS_COLORS[c.status] || '#94a3b8', textTransform: 'uppercase' }}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <footer style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 11 }}>Powered by Tracktio</footer>
    </div>
  )
}
