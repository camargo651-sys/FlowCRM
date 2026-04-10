import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

async function getQuote(token: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  try {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, contacts(name, email, company_name), quote_items(*)')
    .eq('view_token', token)
    .single()

  return quote
  } catch { return null }
}

export default async function QuoteViewPage({ params }: { params: { token: string } }) {
  const quote = await getQuote(params.token)
  if (!quote) notFound()

  const contact = (quote as { contacts?: { name?: string; email?: string; company_name?: string } }).contacts
  const items = ((quote as { quote_items?: { id: string; description: string; quantity: number; unit_price: number; total: number; order_index: number }[] }).quote_items || []).sort((a, b) => a.order_index - b.order_index)

  return (
    <html>
      <head>
        <title>{quote.title} — Proposal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #f8fafc; }
          .container { max-width: 800px; margin: 0 auto; padding: 24px; }
          .card { background: white; border-radius: 16px; padding: 32px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 32px; }
          .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
          .header p { color: #64748b; font-size: 14px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
          .meta-item { padding: 12px; background: #f8fafc; border-radius: 8px; }
          .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; }
          .meta-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .text-right { text-align: right; }
          .total-row { font-size: 18px; font-weight: 700; color: #0891B2; }
          .section-tag { display: inline-block; padding: 2px 8px; background: #eff6ff; color: #3b82f6; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .notes { padding: 16px; background: #fefce8; border-radius: 8px; margin-top: 16px; font-size: 13px; color: #854d0e; }
          .footer { text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="card">
            <div className="header">
              <h1>{quote.title}</h1>
              <p>Proposal #{quote.quote_number}</p>
            </div>

            <div className="meta">
              <div className="meta-item">
                <div className="meta-label">Prepared for</div>
                <div className="meta-value">{contact?.name || 'Client'}</div>
                {contact?.company_name && <div style={{ fontSize: '12px', color: '#64748b' }}>{contact.company_name}</div>}
              </div>
              <div className="meta-item">
                <div className="meta-label">Date</div>
                <div className="meta-value">{new Date(quote.created_at).toLocaleDateString()}</div>
                {quote.valid_until && <div style={{ fontSize: '12px', color: '#64748b' }}>Valid until {new Date(quote.valid_until).toLocaleDateString()}</div>}
              </div>
            </div>

            {/* Items — data-section for tracking */}
            <div data-section="items">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">${Number(item.unit_price).toLocaleString()}</td>
                      <td className="text-right">${Number(item.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing section — tracked separately */}
            <div data-section="pricing" style={{ marginTop: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>Subtotal</span>
                <span style={{ fontSize: '14px' }}>${Number(quote.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(quote.discount_value) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>
                    Discount {quote.discount_type === 'percent' ? `(${quote.discount_value}%)` : ''}
                  </span>
                  <span style={{ fontSize: '14px', color: '#ef4444' }}>
                    -${Number(quote.discount_type === 'percent' ? (quote.subtotal * quote.discount_value / 100) : quote.discount_value).toLocaleString()}
                  </span>
                </div>
              )}
              {Number(quote.tax_rate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '14px' }}>Tax ({quote.tax_rate}%)</span>
                  <span style={{ fontSize: '14px' }}>${Number(quote.tax_amount || 0).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '2px solid #e2e8f0' }}>
                <span className="total-row">Total</span>
                <span className="total-row">${Number(quote.total).toLocaleString()} {quote.currency}</span>
              </div>
            </div>

            {quote.notes && (
              <div className="notes">
                <strong>Notes:</strong> {quote.notes}
              </div>
            )}

            {quote.terms && (
              <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
                <strong>Terms & Conditions:</strong> {quote.terms}
              </div>
            )}
          </div>

          <div className="footer">
            Powered by Tracktio
          </div>
        </div>

        {/* Tracking script */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var token = ${JSON.stringify(params.token)};
            var startTime = Date.now();
            var sectionsViewed = new Set();

            // Track visible sections
            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (entry.isIntersecting && entry.target.dataset.section) {
                  sectionsViewed.add(entry.target.dataset.section);
                }
              });
            }, { threshold: 0.5 });

            document.querySelectorAll('[data-section]').forEach(function(el) {
              observer.observe(el);
            });

            // Send tracking on page unload
            function sendTracking() {
              var duration = Math.round((Date.now() - startTime) / 1000);
              navigator.sendBeacon('/api/quotes/track', JSON.stringify({
                token: token,
                duration_seconds: duration,
                sections_viewed: Array.from(sectionsViewed)
              }));
            }

            // Also send initial view after 3 seconds
            setTimeout(function() {
              var duration = Math.round((Date.now() - startTime) / 1000);
              fetch('/api/quotes/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: token,
                  duration_seconds: duration,
                  sections_viewed: Array.from(sectionsViewed)
                })
              });
            }, 3000);

            document.addEventListener('visibilitychange', function() {
              if (document.visibilityState === 'hidden') sendTracking();
            });
            window.addEventListener('beforeunload', sendTracking);
          })();
        `}} />
      </body>
    </html>
  )
}
