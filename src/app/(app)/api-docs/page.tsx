'use client'
import { useI18n } from '@/lib/i18n/context'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, ChevronDown, ChevronRight, Lock, Globe, Terminal, Play, BookOpen } from 'lucide-react'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  module: string
  params?: { name: string; type: string; required?: boolean; description: string }[]
  body?: { name: string; type: string; required?: boolean; description: string }[]
  response?: string
  requestExample?: string
  responseExample?: string
}

const ENDPOINTS: Endpoint[] = [
  // CRM
  { method: 'GET', path: '/api/v1/contacts', description: 'List contacts with pagination, search, and filters', module: 'CRM',
    params: [
      { name: 'page', type: 'number', description: 'Page number (default: 1)' },
      { name: 'per_page', type: 'number', description: 'Items per page (default: 25, max: 100)' },
      { name: 'search', type: 'string', description: 'Search by name, email, phone, company' },
      { name: 'type', type: 'string', description: 'Filter: person or company' },
      { name: 'score_label', type: 'string', description: 'Filter: hot, warm, cold, inactive' },
      { name: 'sort_by', type: 'string', description: 'Sort field (default: name)' },
      { name: 'sort_order', type: 'string', description: 'asc or desc' },
    ],
    responseExample: `{
  "data": [
    { "id": "uuid", "name": "John Doe", "email": "john@example.com", "type": "person", "score_label": "hot" }
  ],
  "meta": { "total": 42, "page": 1, "per_page": 25 },
  "error": null
}` },
  { method: 'POST', path: '/api/v1/contacts', description: 'Create a new contact', module: 'CRM',
    body: [
      { name: 'name', type: 'string', required: true, description: 'Contact name (1-200 chars)' },
      { name: 'email', type: 'string', description: 'Email address' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'type', type: 'string', description: 'person or company' },
      { name: 'company_name', type: 'string', description: 'Company name' },
      { name: 'tags', type: 'string[]', description: 'Tags array' },
    ],
    requestExample: `{
  "name": "Jane Smith",
  "email": "jane@acme.com",
  "type": "person",
  "company_name": "Acme Corp",
  "tags": ["lead", "inbound"]
}`,
    responseExample: `{
  "data": { "id": "uuid", "name": "Jane Smith", "email": "jane@acme.com", "type": "person" },
  "error": null
}` },
  { method: 'PUT', path: '/api/v1/contacts?id={id}', description: 'Update a contact', module: 'CRM',
    requestExample: `{
  "name": "Jane Smith-Doe",
  "tags": ["lead", "inbound", "qualified"]
}`,
    responseExample: `{
  "data": { "id": "uuid", "name": "Jane Smith-Doe" },
  "error": null
}` },
  { method: 'DELETE', path: '/api/v1/contacts?id={id}', description: 'Delete a contact', module: 'CRM',
    responseExample: `{
  "data": { "deleted": true },
  "error": null
}` },

  { method: 'GET', path: '/api/v1/deals', description: 'List deals with pipeline stage info', module: 'CRM',
    params: [{ name: 'status', type: 'string', description: 'open, won, or lost' }, { name: 'ai_risk', type: 'string', description: 'on_track, at_risk, critical' }],
    responseExample: `{
  "data": [
    { "id": "uuid", "title": "Acme deal", "value": 15000, "status": "open", "ai_risk": "on_track" }
  ],
  "meta": { "total": 8, "page": 1, "per_page": 25 }
}` },
  { method: 'POST', path: '/api/v1/deals', description: 'Create a deal (fires deal.created event)', module: 'CRM',
    body: [{ name: 'title', type: 'string', required: true, description: 'Deal title' }, { name: 'value', type: 'number', description: 'Deal value' }, { name: 'status', type: 'string', description: 'open, won, lost' }],
    requestExample: `{
  "title": "Enterprise plan - Acme Corp",
  "value": 25000,
  "status": "open"
}`,
    responseExample: `{
  "data": { "id": "uuid", "title": "Enterprise plan - Acme Corp", "value": 25000, "status": "open" },
  "error": null
}` },
  { method: 'PUT', path: '/api/v1/deals?id={id}', description: 'Update deal (fires deal.won/lost events)', module: 'CRM' },
  { method: 'GET', path: '/api/v1/quotes', description: 'List quotes/proposals', module: 'CRM' },

  // Invoicing
  { method: 'GET', path: '/api/v1/invoices', description: 'List invoices', module: 'Finance',
    params: [{ name: 'status', type: 'string', description: 'draft, sent, paid, partial, overdue' }],
    responseExample: `{
  "data": [
    { "id": "uuid", "number": "INV-001", "total": 1500, "status": "sent", "due_date": "2026-05-01" }
  ],
  "meta": { "total": 12, "page": 1, "per_page": 25 }
}` },
  { method: 'POST', path: '/api/v1/invoices', description: 'Create invoice', module: 'Finance',
    requestExample: `{
  "contact_id": "uuid",
  "items": [{ "description": "Consulting", "quantity": 10, "unit_price": 150 }],
  "due_date": "2026-05-01"
}` },
  { method: 'GET', path: '/api/v1/payments', description: 'List payments', module: 'Finance' },
  { method: 'POST', path: '/api/v1/payments', description: 'Record payment (auto-updates invoice balance)', module: 'Finance',
    requestExample: `{
  "invoice_id": "uuid",
  "amount": 1500,
  "method": "bank_transfer",
  "date": "2026-04-09"
}` },
  { method: 'GET', path: '/api/v1/recurring-invoices', description: 'List recurring invoices', module: 'Finance' },
  { method: 'POST', path: '/api/v1/recurring-invoices?action=generate', description: 'Generate due recurring invoices', module: 'Finance' },

  // Inventory
  { method: 'GET', path: '/api/v1/products', description: 'List products', module: 'Inventory',
    params: [{ name: 'status', type: 'string', description: 'active, inactive, discontinued' }, { name: 'category_id', type: 'uuid', description: 'Filter by category' }],
    responseExample: `{
  "data": [
    { "id": "uuid", "name": "Widget Pro", "sku": "WP-001", "price": 29.99, "stock": 150, "status": "active" }
  ],
  "meta": { "total": 87, "page": 1, "per_page": 25 }
}` },
  { method: 'POST', path: '/api/v1/products', description: 'Create product', module: 'Inventory',
    requestExample: `{
  "name": "Widget Pro",
  "sku": "WP-001",
  "price": 29.99,
  "stock": 150,
  "category_id": "uuid"
}` },

  // Purchasing
  { method: 'GET', path: '/api/v1/purchase-orders', description: 'List purchase orders', module: 'Inventory' },
  { method: 'POST', path: '/api/v1/purchase-orders', description: 'Create PO', module: 'Inventory' },
  { method: 'PUT', path: '/api/v1/purchase-orders?id={id}', description: 'Update PO (auto-receives stock on status=received)', module: 'Inventory' },
  { method: 'GET', path: '/api/v1/suppliers', description: 'List suppliers', module: 'Inventory' },

  // Accounting
  { method: 'GET', path: '/api/v1/accounts', description: 'List chart of accounts', module: 'Accounting',
    params: [{ name: 'type', type: 'string', description: 'asset, liability, equity, revenue, expense' }] },
  { method: 'POST', path: '/api/v1/journal-entries', description: 'Create journal entry with lines (validates debit=credit)', module: 'Accounting',
    body: [{ name: 'date', type: 'date', required: true, description: 'Entry date' }, { name: 'description', type: 'string', description: 'Description' }, { name: 'lines', type: 'array', required: true, description: 'Array of {account_id, debit, credit}' }],
    requestExample: `{
  "date": "2026-04-09",
  "description": "Office supplies",
  "lines": [
    { "account_id": "uuid-expense", "debit": 250, "credit": 0 },
    { "account_id": "uuid-cash", "debit": 0, "credit": 250 }
  ]
}`,
    responseExample: `{
  "data": { "id": "uuid", "date": "2026-04-09", "description": "Office supplies", "status": "posted" },
  "error": null
}` },

  // HR
  { method: 'GET', path: '/api/v1/employees', description: 'List employees', module: 'HR',
    params: [{ name: 'status', type: 'string', description: 'active, inactive, terminated' }, { name: 'department_id', type: 'uuid', description: 'Filter by department' }],
    responseExample: `{
  "data": [
    { "id": "uuid", "name": "Maria Garcia", "department": "Engineering", "status": "active" }
  ],
  "meta": { "total": 24, "page": 1, "per_page": 25 }
}` },
  { method: 'POST', path: '/api/v1/employees', description: 'Create employee', module: 'HR',
    requestExample: `{
  "name": "Maria Garcia",
  "email": "maria@company.com",
  "department_id": "uuid",
  "position": "Software Engineer",
  "start_date": "2026-04-15"
}` },
  { method: 'GET', path: '/api/v1/departments', description: 'List departments', module: 'HR' },
  { method: 'GET', path: '/api/v1/leave-requests', description: 'List leave requests', module: 'HR' },
  { method: 'POST', path: '/api/v1/payroll', description: 'Create payroll run (auto-generates payslips)', module: 'HR' },

  // Reports
  { method: 'GET', path: '/api/reports?type=pnl', description: 'Profit & Loss report', module: 'Reports', params: [{ name: 'start', type: 'date', description: 'Start date' }, { name: 'end', type: 'date', description: 'End date' }] },
  { method: 'GET', path: '/api/reports?type=balance_sheet', description: 'Balance Sheet report', module: 'Reports' },
  { method: 'GET', path: '/api/reports?type=cashflow', description: 'Cash Flow report', module: 'Reports' },

  // Utility
  { method: 'GET', path: '/api/export?type=contacts', description: 'Export contacts as CSV', module: 'Utility' },
  { method: 'GET', path: '/api/export?type=products', description: 'Export products as CSV', module: 'Utility' },
  { method: 'GET', path: '/api/export?type=deals', description: 'Export deals as CSV', module: 'Utility' },
  { method: 'POST', path: '/api/import', description: 'Import CSV (contacts or products)', module: 'Utility' },
  { method: 'GET', path: '/api/pdf?type=invoice&id={id}', description: 'Generate printable invoice', module: 'Utility' },
  { method: 'POST', path: '/api/email-send', description: 'Send email via connected Gmail/Outlook', module: 'Utility' },
  { method: 'POST', path: '/api/v1/api-keys', description: 'Create API key', module: 'Auth' },
]

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  POST: 'bg-blue-100 text-blue-700 border border-blue-200',
  PUT: 'bg-amber-100 text-amber-700 border border-amber-200',
  DELETE: 'bg-red-100 text-red-700 border border-red-200',
}

const MODULE_ICONS: Record<string, string> = {
  CRM: '\uD83D\uDD00',
  Finance: '\uD83E\uDDFE',
  Inventory: '\uD83D\uDCE6',
  Accounting: '\uD83D\uDCD2',
  HR: '\uD83D\uDC54',
  Reports: '\uD83D\uDCC8',
  Utility: '\uD83D\uDD27',
  Auth: '\uD83D\uDD10',
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  CRM: 'Manage contacts, deals, pipelines, and quotes',
  Finance: 'Invoices, payments, and recurring billing',
  Inventory: 'Products, purchase orders, and suppliers',
  Accounting: 'Chart of accounts and journal entries',
  HR: 'Employees, departments, leave, and payroll',
  Reports: 'Financial and business intelligence reports',
  Utility: 'Import, export, PDF generation, and email',
  Auth: 'API key management and authentication',
}

function buildCurlCommand(ep: Endpoint): string {
  const url = `${API_BASE || 'https://your-domain.com'}${ep.path}`
  const parts = [`curl -X ${ep.method}`]
  parts.push(`  -H "Authorization: Bearer flw_your_key_here"`)
  parts.push(`  -H "Content-Type: application/json"`)
  if (ep.requestExample) {
    // Compact the JSON for curl
    const compact = ep.requestExample.replace(/\n\s*/g, ' ').trim()
    parts.push(`  -d '${compact}'`)
  }
  parts.push(`  "${url}"`)
  return parts.join(' \\\n')
}

export default function ApiDocsPage() {
  const { t } = useI18n()
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const modules = Array.from(new Set(ENDPOINTS.map(e => e.module)))

  const filteredModules = activeModule ? [activeModule] : modules

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-500" />
            {t('nav.api_docs')}
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">REST API v1 — {ENDPOINTS.length} endpoints across {modules.length} categories</p>
        </div>
      </div>

      {/* Base URL */}
      <div className="card p-4 mb-4 bg-gradient-to-r from-surface-900 to-surface-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">Base URL</p>
            <code className="text-sm font-mono text-emerald-400">{API_BASE || 'https://your-domain.com'}</code>
          </div>
          <div className="flex items-center gap-2 text-xs text-surface-400">
            <span className="px-2 py-1 rounded bg-surface-700 text-surface-300 font-mono">v1</span>
            <span className="px-2 py-1 rounded bg-emerald-900/40 text-emerald-400 font-semibold">Stable</span>
          </div>
        </div>
      </div>

      {/* Authentication */}
      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Lock className="w-4 h-4 text-brand-500" /> Authentication</h3>
        <p className="text-xs text-surface-500 mb-3">All API requests require a Bearer token in the <code className="bg-surface-100 px-1.5 py-0.5 rounded text-brand-600">Authorization</code> header. Create API keys in <strong>Settings &gt; Company &gt; API Keys</strong>.</p>
        <div className="bg-surface-900 rounded-xl p-4 font-mono text-xs text-emerald-400">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-surface-500 font-sans uppercase tracking-wider">Required Headers</span>
            <button onClick={() => copyToClipboard(`Authorization: Bearer flw_your_key_here\nContent-Type: application/json`, -1)} className="text-surface-400 hover:text-white transition-colors">
              {copiedIdx === -1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="space-y-1">
            <div><span className="text-surface-500">Authorization:</span> Bearer flw_your_key_here</div>
            <div><span className="text-surface-500">Content-Type:</span> application/json</div>
          </div>
        </div>
      </div>

      {/* Response Format */}
      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Globe className="w-4 h-4 text-brand-500" /> Response Format</h3>
        <p className="text-xs text-surface-500 mb-3">All responses return JSON with a consistent envelope structure. List endpoints include pagination metadata.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1.5">200 — Success (List)</p>
            <pre className="bg-surface-50 rounded-lg p-3 text-[11px] text-surface-700 overflow-x-auto border border-surface-100">{`{
  "data": [...],
  "meta": { "total": 42, "page": 1, "per_page": 25 },
  "error": null
}`}</pre>
          </div>
          <div>
            <p className="text-[10px] text-red-600 font-bold uppercase mb-1.5">4xx / 5xx — Error</p>
            <pre className="bg-surface-50 rounded-lg p-3 text-[11px] text-surface-700 overflow-x-auto border border-surface-100">{`{
  "data": null,
  "error": {
    "message": "Validation failed: name is required"
  }
}`}</pre>
          </div>
        </div>
      </div>

      {/* Module Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setActiveModule(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
            !activeModule ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          )}
        >
          All ({ENDPOINTS.length})
        </button>
        {modules.map(mod => {
          const count = ENDPOINTS.filter(e => e.module === mod).length
          return (
            <button
              key={mod}
              onClick={() => setActiveModule(activeModule === mod ? null : mod)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                activeModule === mod ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              <span>{MODULE_ICONS[mod] || ''}</span>
              {mod}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', activeModule === mod ? 'bg-white/20' : 'bg-surface-200')}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Endpoints by module */}
      {filteredModules.map(module => (
        <div key={module} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">{MODULE_ICONS[module] || ''}</span>
            <div>
              <h2 className="text-sm font-bold text-surface-800 uppercase tracking-wide">{module}</h2>
              <p className="text-xs text-surface-400">{MODULE_DESCRIPTIONS[module] || ''}</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-surface-400 bg-surface-100 px-2 py-1 rounded-full">
              {ENDPOINTS.filter(e => e.module === module).length} endpoints
            </span>
          </div>
          <div className="space-y-1.5">
            {ENDPOINTS.filter(e => e.module === module).map((ep) => {
              const globalIdx = ENDPOINTS.indexOf(ep)
              const isOpen = expandedIdx === globalIdx
              return (
                <div key={`${ep.method}-${ep.path}`} className={cn('card overflow-hidden transition-all', isOpen && 'ring-1 ring-brand-200 shadow-md')}>
                  <button onClick={() => setExpandedIdx(isOpen ? null : globalIdx)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-surface-50 transition-colors text-left">
                    <span className={cn('text-[10px] font-bold px-2.5 py-0.5 rounded-md', METHOD_COLORS[ep.method])}>{ep.method}</span>
                    <code className="text-xs text-surface-800 font-mono flex-1 truncate">{ep.path}</code>
                    <span className="text-xs text-surface-400 hidden sm:block max-w-[280px] truncate">{ep.description}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-surface-300 shrink-0" /> : <ChevronRight className="w-4 h-4 text-surface-300 shrink-0" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-surface-100 animate-fade-in">
                      <div className="px-4 py-4 space-y-4">
                        {/* Description */}
                        <p className="text-sm text-surface-600">{ep.description}</p>

                        {/* Query Parameters */}
                        {ep.params && (
                          <div>
                            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Query Parameters</p>
                            <div className="bg-surface-50 rounded-lg p-3 space-y-2">
                              {ep.params.map(p => (
                                <div key={p.name} className="flex items-start gap-2 text-xs">
                                  <code className="bg-white px-1.5 py-0.5 rounded font-mono text-brand-600 border border-surface-200 shrink-0">{p.name}</code>
                                  <span className="text-surface-400 shrink-0">{p.type}</span>
                                  {p.required && <span className="text-red-500 text-[9px] font-bold shrink-0">required</span>}
                                  <span className="text-surface-600">{p.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Body */}
                        {ep.body && (
                          <div>
                            <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Request Body (JSON)</p>
                            <div className="bg-surface-50 rounded-lg p-3 space-y-2">
                              {ep.body.map(b => (
                                <div key={b.name} className="flex items-start gap-2 text-xs">
                                  <code className="bg-white px-1.5 py-0.5 rounded font-mono text-brand-600 border border-surface-200 shrink-0">{b.name}</code>
                                  <span className="text-surface-400 shrink-0">{b.type}</span>
                                  {b.required && <span className="text-red-500 text-[9px] font-bold shrink-0">required</span>}
                                  <span className="text-surface-600">{b.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Request Example */}
                        {ep.requestExample && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Request Example</p>
                              <button
                                onClick={() => copyToClipboard(ep.requestExample!, globalIdx * 100)}
                                className="text-surface-400 hover:text-surface-700 transition-colors"
                              >
                                {copiedIdx === globalIdx * 100 ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <pre className="bg-surface-900 rounded-lg p-3 text-[11px] text-emerald-400 overflow-x-auto">{ep.requestExample}</pre>
                          </div>
                        )}

                        {/* Response Example */}
                        {ep.responseExample && (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Response Example</p>
                              <button
                                onClick={() => copyToClipboard(ep.responseExample!, globalIdx * 100 + 1)}
                                className="text-surface-400 hover:text-surface-700 transition-colors"
                              >
                                {copiedIdx === globalIdx * 100 + 1 ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <pre className="bg-surface-50 rounded-lg p-3 text-[11px] text-surface-700 overflow-x-auto border border-surface-100">{ep.responseExample}</pre>
                          </div>
                        )}

                        {/* Try it — curl copy */}
                        <div className="pt-2 border-t border-surface-100">
                          <button
                            onClick={() => copyToClipboard(buildCurlCommand(ep), globalIdx * 100 + 2)}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                              copiedIdx === globalIdx * 100 + 2
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200'
                            )}
                          >
                            {copiedIdx === globalIdx * 100 + 2 ? (
                              <><Check className="w-3.5 h-3.5" /> Copied to clipboard!</>
                            ) : (
                              <><Terminal className="w-3.5 h-3.5" /> Try it — copy curl command</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Rate Limiting note */}
      <div className="card p-5 mt-4 mb-8 border-amber-200 bg-amber-50/50">
        <h3 className="font-semibold text-surface-900 mb-1 text-sm">Rate Limiting</h3>
        <p className="text-xs text-surface-600 leading-relaxed">
          API requests are limited to <strong>100 requests/minute</strong> per API key. Rate limit info is returned in response headers:
          <code className="bg-white px-1.5 py-0.5 rounded text-amber-700 ml-1 border border-amber-200">X-RateLimit-Remaining</code> and
          <code className="bg-white px-1.5 py-0.5 rounded text-amber-700 ml-1 border border-amber-200">X-RateLimit-Reset</code>.
          Exceeding the limit returns a <code className="bg-white px-1.5 py-0.5 rounded text-red-600 border border-red-200">429 Too Many Requests</code> response.
        </p>
      </div>
    </div>
  )
}
