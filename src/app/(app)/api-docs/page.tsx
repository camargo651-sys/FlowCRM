'use client'
import { useI18n } from '@/lib/i18n/context'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Copy, Check, ChevronDown, ChevronRight, Lock, Globe } from 'lucide-react'

const API_BASE = typeof window !== 'undefined' ? window.location.origin : ''

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  module: string
  params?: { name: string; type: string; required?: boolean; description: string }[]
  body?: { name: string; type: string; required?: boolean; description: string }[]
  response?: string
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
    ] },
  { method: 'POST', path: '/api/v1/contacts', description: 'Create a new contact', module: 'CRM',
    body: [
      { name: 'name', type: 'string', required: true, description: 'Contact name (1-200 chars)' },
      { name: 'email', type: 'string', description: 'Email address' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'type', type: 'string', description: 'person or company' },
      { name: 'company_name', type: 'string', description: 'Company name' },
      { name: 'tags', type: 'string[]', description: 'Tags array' },
    ] },
  { method: 'PUT', path: '/api/v1/contacts?id={id}', description: 'Update a contact', module: 'CRM' },
  { method: 'DELETE', path: '/api/v1/contacts?id={id}', description: 'Delete a contact', module: 'CRM' },

  { method: 'GET', path: '/api/v1/deals', description: 'List deals with pipeline stage info', module: 'CRM',
    params: [{ name: 'status', type: 'string', description: 'open, won, or lost' }, { name: 'ai_risk', type: 'string', description: 'on_track, at_risk, critical' }] },
  { method: 'POST', path: '/api/v1/deals', description: 'Create a deal (fires deal.created event)', module: 'CRM',
    body: [{ name: 'title', type: 'string', required: true, description: 'Deal title' }, { name: 'value', type: 'number', description: 'Deal value' }, { name: 'status', type: 'string', description: 'open, won, lost' }] },
  { method: 'PUT', path: '/api/v1/deals?id={id}', description: 'Update deal (fires deal.won/lost events)', module: 'CRM' },
  { method: 'GET', path: '/api/v1/quotes', description: 'List quotes/proposals', module: 'CRM' },

  // Invoicing
  { method: 'GET', path: '/api/v1/invoices', description: 'List invoices', module: 'Invoicing', params: [{ name: 'status', type: 'string', description: 'draft, sent, paid, partial, overdue' }] },
  { method: 'POST', path: '/api/v1/invoices', description: 'Create invoice', module: 'Invoicing' },
  { method: 'GET', path: '/api/v1/payments', description: 'List payments', module: 'Invoicing' },
  { method: 'POST', path: '/api/v1/payments', description: 'Record payment (auto-updates invoice balance)', module: 'Invoicing' },
  { method: 'GET', path: '/api/v1/recurring-invoices', description: 'List recurring invoices', module: 'Invoicing' },
  { method: 'POST', path: '/api/v1/recurring-invoices?action=generate', description: 'Generate due recurring invoices', module: 'Invoicing' },

  // Inventory
  { method: 'GET', path: '/api/v1/products', description: 'List products', module: 'Inventory', params: [{ name: 'status', type: 'string', description: 'active, inactive, discontinued' }, { name: 'category_id', type: 'uuid', description: 'Filter by category' }] },
  { method: 'POST', path: '/api/v1/products', description: 'Create product', module: 'Inventory' },

  // Purchasing
  { method: 'GET', path: '/api/v1/purchase-orders', description: 'List purchase orders', module: 'Purchasing' },
  { method: 'POST', path: '/api/v1/purchase-orders', description: 'Create PO', module: 'Purchasing' },
  { method: 'PUT', path: '/api/v1/purchase-orders?id={id}', description: 'Update PO (auto-receives stock on status=received)', module: 'Purchasing' },
  { method: 'GET', path: '/api/v1/suppliers', description: 'List suppliers', module: 'Purchasing' },

  // Accounting
  { method: 'GET', path: '/api/v1/accounts', description: 'List chart of accounts', module: 'Accounting', params: [{ name: 'type', type: 'string', description: 'asset, liability, equity, revenue, expense' }] },
  { method: 'POST', path: '/api/v1/journal-entries', description: 'Create journal entry with lines (validates debit=credit)', module: 'Accounting',
    body: [{ name: 'date', type: 'date', required: true, description: 'Entry date' }, { name: 'description', type: 'string', description: 'Description' }, { name: 'lines', type: 'array', required: true, description: 'Array of {account_id, debit, credit}' }] },

  // HR
  { method: 'GET', path: '/api/v1/employees', description: 'List employees', module: 'HR', params: [{ name: 'status', type: 'string', description: 'active, inactive, terminated' }, { name: 'department_id', type: 'uuid', description: 'Filter by department' }] },
  { method: 'POST', path: '/api/v1/employees', description: 'Create employee', module: 'HR' },
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
  GET: 'bg-emerald-100 text-emerald-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function ApiDocsPage() {
  const { t } = useI18n()
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const modules = Array.from(new Set(ENDPOINTS.map(e => e.module)))

  const copyExample = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.api_docs')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">REST API v1 — {ENDPOINTS.length} endpoints</p>
        </div>
      </div>

      {/* Auth info */}
      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Lock className="w-4 h-4" /> Authentication</h3>
        <p className="text-xs text-surface-500 mb-3">All API requests require a Bearer token. Create one in Settings {'>'} Company {'>'} API Keys.</p>
        <div className="bg-surface-900 rounded-xl p-4 font-mono text-xs text-emerald-400 flex items-center justify-between">
          <span>curl -H "Authorization: Bearer flw_your_key_here" {API_BASE}/api/v1/contacts</span>
          <button onClick={() => copyExample(`curl -H "Authorization: Bearer flw_your_key_here" ${API_BASE}/api/v1/contacts`)} className="text-surface-400 hover:text-white ml-4">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Response format */}
      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2"><Globe className="w-4 h-4" /> Response Format</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-surface-400 font-semibold uppercase mb-1">Success (List)</p>
            <pre className="bg-surface-50 rounded-lg p-3 text-[11px] text-surface-700 overflow-x-auto">{`{
  "data": [...],
  "meta": { "total": 42, "page": 1, "per_page": 25 },
  "error": null
}`}</pre>
          </div>
          <div>
            <p className="text-[10px] text-surface-400 font-semibold uppercase mb-1">Error</p>
            <pre className="bg-surface-50 rounded-lg p-3 text-[11px] text-surface-700 overflow-x-auto">{`{
  "data": null,
  "error": { "message": "Validation failed: name: Required" }
}`}</pre>
          </div>
        </div>
      </div>

      {/* Endpoints by module */}
      {modules.map(module => (
        <div key={module} className="mb-6">
          <h2 className="text-sm font-bold text-surface-700 mb-3 uppercase tracking-wide">{module}</h2>
          <div className="space-y-1">
            {ENDPOINTS.filter(e => e.module === module).map((ep, i) => {
              const globalIdx = ENDPOINTS.indexOf(ep)
              const isOpen = expandedIdx === globalIdx
              return (
                <div key={`${ep.method}-${ep.path}`} className="card overflow-hidden">
                  <button onClick={() => setExpandedIdx(isOpen ? null : globalIdx)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-surface-50 transition-colors text-left">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', METHOD_COLORS[ep.method])}>{ep.method}</span>
                    <code className="text-xs text-surface-800 font-mono flex-1">{ep.path}</code>
                    <span className="text-xs text-surface-400 hidden sm:block">{ep.description}</span>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-surface-300" /> : <ChevronRight className="w-4 h-4 text-surface-300" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 border-t border-surface-50 pt-3 animate-fade-in">
                      <p className="text-xs text-surface-600 mb-3">{ep.description}</p>
                      {ep.params && (
                        <div className="mb-3">
                          <p className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Query Parameters</p>
                          <div className="space-y-1">
                            {ep.params.map(p => (
                              <div key={p.name} className="flex items-center gap-2 text-xs">
                                <code className="bg-surface-100 px-1.5 py-0.5 rounded font-mono text-brand-600">{p.name}</code>
                                <span className="text-surface-400">{p.type}</span>
                                {p.required && <span className="text-red-500 text-[9px]">required</span>}
                                <span className="text-surface-500">{p.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ep.body && (
                        <div>
                          <p className="text-[10px] font-semibold text-surface-400 uppercase mb-1">Request Body (JSON)</p>
                          <div className="space-y-1">
                            {ep.body.map(b => (
                              <div key={b.name} className="flex items-center gap-2 text-xs">
                                <code className="bg-surface-100 px-1.5 py-0.5 rounded font-mono text-brand-600">{b.name}</code>
                                <span className="text-surface-400">{b.type}</span>
                                {b.required && <span className="text-red-500 text-[9px]">required</span>}
                                <span className="text-surface-500">{b.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
