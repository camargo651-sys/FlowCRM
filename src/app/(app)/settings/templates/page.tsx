'use client'
import { DbRow } from '@/types'
import { toast } from 'sonner'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, X, Save, FileText, Eye, Trash2, Copy, ChevronUp, ChevronDown,
  GripVertical, Type, Table, PenLine, Minus, FileSignature, AlertCircle,
  Printer, Mail, MessageCircle, Code, LayoutGrid, Download,
  Sparkles, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { useI18n } from '@/lib/i18n/context'

// ---------------------------------------------------------------------------
// Sanitize
// ---------------------------------------------------------------------------
function sanitizeHTML(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote / Proposal' },
  { value: 'contract', label: 'Contract' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'custom', label: 'Custom' },
]

const VARIABLES: Record<string, string[]> = {
  invoice: ['{{company_name}}', '{{company_address}}', '{{company_tax_id}}', '{{client_name}}', '{{client_email}}', '{{invoice_number}}', '{{issue_date}}', '{{due_date}}', '{{items_table}}', '{{subtotal}}', '{{tax}}', '{{total}}', '{{notes}}', '{{terms}}'],
  quote: ['{{company_name}}', '{{client_name}}', '{{quote_number}}', '{{date}}', '{{valid_until}}', '{{items_table}}', '{{subtotal}}', '{{total}}', '{{notes}}', '{{terms}}'],
  contract: ['{{company_name}}', '{{client_name}}', '{{contract_number}}', '{{start_date}}', '{{end_date}}', '{{value}}', '{{terms}}'],
  receipt: ['{{company_name}}', '{{client_name}}', '{{amount}}', '{{payment_date}}', '{{method}}', '{{reference}}'],
  custom: ['{{company_name}}', '{{client_name}}', '{{date}}'],
}

// ---------------------------------------------------------------------------
// Block types for the visual editor
// ---------------------------------------------------------------------------
type BlockType = 'header' | 'text' | 'client_info' | 'items_table' | 'totals' | 'signature' | 'divider' | 'terms'

interface Block {
  id: string
  type: BlockType
  content: string
  label?: string
}

const BLOCK_TYPES: { value: BlockType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'header', label: 'Header', icon: <FileText className="w-4 h-4" />, description: 'Company logo, document title, number & date' },
  { value: 'text', label: 'Text', icon: <Type className="w-4 h-4" />, description: 'Rich text paragraph' },
  { value: 'client_info', label: 'Client Info', icon: <PenLine className="w-4 h-4" />, description: 'Auto-filled client details block' },
  { value: 'items_table', label: 'Items Table', icon: <Table className="w-4 h-4" />, description: 'Line items with quantities and prices' },
  { value: 'totals', label: 'Totals', icon: <AlertCircle className="w-4 h-4" />, description: 'Subtotal, tax, and total' },
  { value: 'signature', label: 'Signature', icon: <FileSignature className="w-4 h-4" />, description: 'Signature line with name and date' },
  { value: 'divider', label: 'Divider', icon: <Minus className="w-4 h-4" />, description: 'Horizontal separator line' },
  { value: 'terms', label: 'Terms', icon: <AlertCircle className="w-4 h-4" />, description: 'Small print terms & conditions' },
]

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function defaultBlockContent(type: BlockType): string {
  switch (type) {
    case 'header': return '{{company_name}}'
    case 'text': return 'Enter your text here...'
    case 'client_info': return '{{client_name}}'
    case 'items_table': return '{{items_table}}'
    case 'totals': return '{{subtotal}} / {{tax}} / {{total}}'
    case 'signature': return 'Authorized Signature'
    case 'divider': return ''
    case 'terms': return '{{terms}}'
  }
}

// ---------------------------------------------------------------------------
// Render blocks to HTML
// ---------------------------------------------------------------------------
function blocksToHTML(blocks: Block[]): string {
  const parts = blocks.map(b => {
    switch (b.type) {
      case 'header':
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <div>
    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#0891B2;margin-bottom:8px;">LOGO</div>
    <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">${esc(b.content || '{{company_name}}')}</h1>
    <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  </div>
  <div style="text-align:right;">
    <h2 style="font-size:20px;font-weight:800;color:#0891B2;margin:0;">DOCUMENT</h2>
    <p style="color:#64748b;font-size:12px;">{{invoice_number}}</p>
    <p style="color:#64748b;font-size:12px;">{{issue_date}}</p>
  </div>
</div>`
      case 'text':
        return `<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">${esc(b.content)}</div>`
      case 'client_info':
        return `<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px;">
  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Bill To</p>
  <p style="font-weight:600;margin:0;font-size:14px;">{{client_name}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">{{client_email}}</p>
</div>`
      case 'items_table':
        return `<div style="margin-bottom:20px;">{{items_table}}</div>`
      case 'totals':
        return `<div style="text-align:right;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:8px;">
  <p style="font-size:13px;color:#64748b;margin:0 0 4px 0;">Subtotal: {{subtotal}}</p>
  <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;">Tax: {{tax}}</p>
  <p style="font-size:20px;font-weight:800;color:#0891B2;margin:0;">Total: {{total}}</p>
</div>`
      case 'signature':
        return `<div style="margin-top:40px;margin-bottom:20px;">
  <div style="border-top:1px solid #1e293b;width:250px;padding-top:8px;">
    <p style="font-size:12px;color:#64748b;margin:0;">${esc(b.content || 'Authorized Signature')}</p>
    <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: {{issue_date}}</p>
  </div>
</div>`
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`
      case 'terms':
        return `<div style="margin-top:16px;font-size:10px;line-height:1.5;color:#94a3b8;">${esc(b.content || '{{terms}}')}</div>`
    }
  })
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">\n${parts.join('\n')}\n</div>`
}

function esc(s: string): string {
  // Allow template variables through, escape basic HTML in user text
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/{{/g, '{{').replace(/}}/g, '}}')
}

// ---------------------------------------------------------------------------
// Parse HTML back to blocks (best effort)
// ---------------------------------------------------------------------------
function htmlToBlocks(html: string): Block[] | null {
  // Only parse if it looks like our block-generated HTML
  if (!html.includes('font-family:-apple-system') && !html.includes('font-family: -apple-system')) return null
  // Fallback: return null to indicate it's raw HTML
  return null
}

// ---------------------------------------------------------------------------
// Template rendering utility
// ---------------------------------------------------------------------------
const SAMPLE_DATA: Record<string, string> = {
  company_name: 'Your Company',
  company_address: '123 Business St, Suite 100, City, ST 12345',
  company_tax_id: 'TAX-123456789',
  client_name: 'John Doe',
  client_email: 'john@example.com',
  invoice_number: 'INV-0001',
  quote_number: 'QUO-0001',
  contract_number: 'CTR-0001',
  issue_date: new Date().toLocaleDateString(),
  date: new Date().toLocaleDateString(),
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  start_date: new Date().toLocaleDateString(),
  end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  items_table: '<table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr style="border-bottom:2px solid #e2e8f0"><th style="text-align:left;padding:10px 8px;font-size:11px;color:#94a3b8;text-transform:uppercase">Item</th><th style="text-align:center;padding:10px 8px;font-size:11px;color:#94a3b8">Qty</th><th style="text-align:right;padding:10px 8px;font-size:11px;color:#94a3b8">Price</th><th style="text-align:right;padding:10px 8px;font-size:11px;color:#94a3b8">Total</th></tr></thead><tbody><tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 8px;font-size:13px">Professional Services</td><td style="padding:10px 8px;font-size:13px;text-align:center">10</td><td style="padding:10px 8px;font-size:13px;text-align:right">$100.00</td><td style="padding:10px 8px;font-size:13px;text-align:right">$1,000.00</td></tr><tr style="border-bottom:1px solid #f1f5f9"><td style="padding:10px 8px;font-size:13px">Consulting Hours</td><td style="padding:10px 8px;font-size:13px;text-align:center">5</td><td style="padding:10px 8px;font-size:13px;text-align:right">$150.00</td><td style="padding:10px 8px;font-size:13px;text-align:right">$750.00</td></tr></tbody></table>',
  subtotal: '$1,750.00',
  tax: '$140.00',
  total: '$1,890.00',
  amount: '$1,890.00',
  payment_date: new Date().toLocaleDateString(),
  method: 'Bank Transfer',
  reference: 'REF-20260409',
  value: '$25,000.00',
  notes: 'Thank you for your business. Please make payment within 30 days.',
  terms: 'Payment is due within 30 days. Late payments may incur a 1.5% monthly fee. All services are non-refundable once delivered.',
}

function renderTemplate(template: string, data: Record<string, string>): string {
  let html = template
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  // Replace any remaining variables with dash
  html = html.replace(/\{\{\w+\}\}/g, '—')
  return html
}

// ---------------------------------------------------------------------------
// PRE-BUILT TEMPLATE LIBRARY (10 templates)
// ---------------------------------------------------------------------------
interface LibraryTemplate {
  name: string
  type: string
  category: string
  description: string
  blocks: Block[]
  html_content: string
}

const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ---- SERVICE BUSINESSES ----
  {
    name: 'Service Invoice',
    type: 'invoice',
    category: 'Service Businesses',
    description: 'Clean invoice with logo, items table, totals, and payment terms',
    blocks: [
      { id: 'h1', type: 'header', content: '{{company_name}}' },
      { id: 'ci1', type: 'client_info', content: '{{client_name}}' },
      { id: 'it1', type: 'items_table', content: '{{items_table}}' },
      { id: 'to1', type: 'totals', content: '{{subtotal}} / {{tax}} / {{total}}' },
      { id: 'd1', type: 'divider', content: '' },
      { id: 'te1', type: 'terms', content: 'Payment is due within 30 days of invoice date. Late payments are subject to a 1.5% monthly finance charge. Please include invoice number with your payment.' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <div>
    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#0891B2;margin-bottom:8px;">LOGO</div>
    <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
    <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
    <p style="color:#64748b;font-size:11px;margin-top:1px;">Tax ID: {{company_tax_id}}</p>
  </div>
  <div style="text-align:right;">
    <h2 style="font-size:28px;font-weight:800;color:#0891B2;margin:0;">INVOICE</h2>
    <p style="color:#64748b;font-size:12px;margin-top:4px;">{{invoice_number}}</p>
    <p style="color:#64748b;font-size:12px;">Date: {{issue_date}}</p>
    <p style="color:#64748b;font-size:12px;">Due: {{due_date}}</p>
  </div>
</div>
<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:24px;">
  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Bill To</p>
  <p style="font-weight:600;margin:0;font-size:14px;">{{client_name}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">{{client_email}}</p>
</div>
{{items_table}}
<div style="text-align:right;margin:20px 0 24px;padding:16px;background:#f8fafc;border-radius:8px;">
  <p style="font-size:13px;color:#64748b;margin:0 0 4px 0;">Subtotal: {{subtotal}}</p>
  <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;">Tax: {{tax}}</p>
  <p style="font-size:22px;font-weight:800;color:#0891B2;margin:0;">Total: {{total}}</p>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="font-size:12px;color:#64748b;margin-bottom:8px;">{{notes}}</div>
<div style="font-size:10px;line-height:1.5;color:#94a3b8;">Payment is due within 30 days of invoice date. Late payments are subject to a 1.5% monthly finance charge. Please include invoice number with your payment.</div>
</div>`,
  },
  {
    name: 'Service Proposal',
    type: 'quote',
    category: 'Service Businesses',
    description: 'Cover page, scope of work, timeline, pricing table, and terms',
    blocks: [
      { id: 'h2', type: 'header', content: '{{company_name}}' },
      { id: 't2a', type: 'text', content: 'PROPOSAL — Prepared for {{client_name}}' },
      { id: 'd2a', type: 'divider', content: '' },
      { id: 't2b', type: 'text', content: 'Scope of Work: We will provide the following services as outlined below. Our team is committed to delivering high-quality results within the agreed timeline.' },
      { id: 'it2', type: 'items_table', content: '{{items_table}}' },
      { id: 'to2', type: 'totals', content: '{{subtotal}} / {{tax}} / {{total}}' },
      { id: 't2c', type: 'text', content: 'Timeline: Work will commence within 5 business days of acceptance and will be completed within the estimated timeframe for each deliverable.' },
      { id: 'd2b', type: 'divider', content: '' },
      { id: 'sig2', type: 'signature', content: 'Client Acceptance' },
      { id: 'te2', type: 'terms', content: 'This proposal is valid until {{valid_until}}. Prices are subject to change after the validity period. A 50% deposit is required to commence work.' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <div>
    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#0891B2;margin-bottom:8px;">LOGO</div>
    <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
    <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  </div>
  <div style="text-align:right;">
    <h2 style="font-size:24px;font-weight:800;color:#0891B2;margin:0;">PROPOSAL</h2>
    <p style="color:#64748b;font-size:12px;">{{quote_number}}</p>
    <p style="color:#64748b;font-size:12px;">{{date}}</p>
  </div>
</div>
<div style="background:#0891B2;color:white;padding:24px;border-radius:12px;margin-bottom:24px;text-align:center;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px 0;opacity:0.8;">Prepared for</p>
  <h3 style="font-size:20px;font-weight:700;margin:0;">{{client_name}}</h3>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 12px 0;">Scope of Work</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">We will provide the following services as outlined below. Our team is committed to delivering high-quality results within the agreed timeline.</div>
{{items_table}}
<div style="text-align:right;margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px;">
  <p style="font-size:13px;color:#64748b;margin:0 0 4px 0;">Subtotal: {{subtotal}}</p>
  <p style="font-size:13px;color:#64748b;margin:0 0 8px 0;">Tax: {{tax}}</p>
  <p style="font-size:20px;font-weight:800;color:#0891B2;margin:0;">Total: {{total}}</p>
</div>
<h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:24px 0 12px 0;">Timeline</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Work will commence within 5 business days of acceptance and will be completed within the estimated timeframe for each deliverable.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="margin-top:40px;margin-bottom:20px;">
  <div style="border-top:1px solid #1e293b;width:250px;padding-top:8px;">
    <p style="font-size:12px;color:#64748b;margin:0;">Client Acceptance</p>
    <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p>
  </div>
</div>
<div style="font-size:10px;line-height:1.5;color:#94a3b8;">This proposal is valid until {{valid_until}}. Prices are subject to change after the validity period. A 50% deposit is required to commence work.</div>
</div>`,
  },
  {
    name: 'Service Contract',
    type: 'contract',
    category: 'Service Businesses',
    description: 'Parties, scope, duration, payment terms, termination, signatures',
    blocks: [
      { id: 'h3', type: 'header', content: '{{company_name}}' },
      { id: 't3a', type: 'text', content: 'SERVICE AGREEMENT' },
      { id: 'd3a', type: 'divider', content: '' },
      { id: 't3b', type: 'text', content: 'This Service Agreement ("Agreement") is entered into as of {{start_date}} by and between {{company_name}} ("Provider") and {{client_name}} ("Client").' },
      { id: 't3c', type: 'text', content: '1. SCOPE OF SERVICES — Provider agrees to perform the services as described in the attached schedule or as mutually agreed upon in writing.' },
      { id: 't3d', type: 'text', content: '2. TERM — This Agreement begins on {{start_date}} and continues until {{end_date}}, unless terminated earlier in accordance with the terms herein.' },
      { id: 't3e', type: 'text', content: '3. COMPENSATION — Client agrees to pay Provider the total amount of {{value}} for the services described herein, payable according to the agreed schedule.' },
      { id: 't3f', type: 'text', content: '4. TERMINATION — Either party may terminate this Agreement with 30 days written notice. Upon termination, Client shall pay for all services rendered.' },
      { id: 'd3b', type: 'divider', content: '' },
      { id: 'sig3a', type: 'signature', content: 'Provider: {{company_name}}' },
      { id: 'sig3b', type: 'signature', content: 'Client: {{client_name}}' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  <h2 style="font-size:20px;font-weight:800;color:#0891B2;margin:16px 0 0 0;">SERVICE AGREEMENT</h2>
  <p style="color:#64748b;font-size:12px;">Contract {{contract_number}}</p>
</div>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Service Agreement ("Agreement") is entered into as of <strong>{{start_date}}</strong> by and between <strong>{{company_name}}</strong> ("Provider") and <strong>{{client_name}}</strong> ("Client").</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">1. SCOPE OF SERVICES</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Provider agrees to perform the services as described in the attached schedule or as mutually agreed upon in writing.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">2. TERM</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Agreement begins on <strong>{{start_date}}</strong> and continues until <strong>{{end_date}}</strong>, unless terminated earlier in accordance with the terms herein.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">3. COMPENSATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Client agrees to pay Provider the total amount of <strong>{{value}}</strong> for the services described herein, payable according to the agreed schedule.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">4. TERMINATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Either party may terminate this Agreement with 30 days written notice. Upon termination, Client shall pay for all services rendered up to the termination date.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="display:flex;gap:60px;margin-top:40px;">
  <div style="flex:1;">
    <div style="border-top:1px solid #1e293b;padding-top:8px;">
      <p style="font-size:12px;color:#64748b;margin:0;">Provider: {{company_name}}</p>
      <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: {{start_date}}</p>
    </div>
  </div>
  <div style="flex:1;">
    <div style="border-top:1px solid #1e293b;padding-top:8px;">
      <p style="font-size:12px;color:#64748b;margin:0;">Client: {{client_name}}</p>
      <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p>
    </div>
  </div>
</div>
</div>`,
  },
  // ---- LEGAL / IMMIGRATION ----
  {
    name: 'NDA / Confidentiality Agreement',
    type: 'contract',
    category: 'Legal / Immigration',
    description: 'Parties, confidential info definition, obligations, duration, jurisdiction',
    blocks: [
      { id: 'h4', type: 'header', content: '{{company_name}}' },
      { id: 't4a', type: 'text', content: 'NON-DISCLOSURE AGREEMENT' },
      { id: 'd4a', type: 'divider', content: '' },
      { id: 't4b', type: 'text', content: 'This Non-Disclosure Agreement is entered into by {{company_name}} ("Disclosing Party") and {{client_name}} ("Receiving Party").' },
      { id: 't4c', type: 'text', content: '1. DEFINITION — "Confidential Information" means any non-public information disclosed by either party, including but not limited to business plans, technical data, trade secrets, and client lists.' },
      { id: 't4d', type: 'text', content: '2. OBLIGATIONS — The Receiving Party shall hold all Confidential Information in strict confidence and shall not disclose it to any third party without prior written consent.' },
      { id: 't4e', type: 'text', content: '3. DURATION — This Agreement shall remain in effect from {{start_date}} until {{end_date}}, and confidentiality obligations shall survive termination for a period of 2 years.' },
      { id: 't4f', type: 'text', content: '4. JURISDICTION — This Agreement shall be governed by applicable laws. Any disputes shall be resolved through binding arbitration.' },
      { id: 'd4b', type: 'divider', content: '' },
      { id: 'sig4a', type: 'signature', content: 'Disclosing Party' },
      { id: 'sig4b', type: 'signature', content: 'Receiving Party' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px double #1e293b;">
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  <h2 style="font-size:18px;font-weight:800;color:#1e293b;margin:20px 0 0 0;letter-spacing:3px;">NON-DISCLOSURE AGREEMENT</h2>
</div>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Non-Disclosure Agreement ("Agreement") is entered into as of <strong>{{start_date}}</strong> by and between <strong>{{company_name}}</strong> ("Disclosing Party") and <strong>{{client_name}}</strong> ("Receiving Party"), collectively referred to as the "Parties."</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">1. DEFINITION OF CONFIDENTIAL INFORMATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">"Confidential Information" means any non-public information disclosed by either party to the other, whether orally, in writing, or by inspection, including but not limited to: business plans, technical data, trade secrets, client lists, financial information, and proprietary methodologies.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">2. OBLIGATIONS OF RECEIVING PARTY</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">The Receiving Party shall: (a) hold all Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent; (c) use it only for the purpose for which it was disclosed; (d) protect it with at least the same degree of care used for its own confidential information.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">3. DURATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Agreement shall remain in effect from <strong>{{start_date}}</strong> until <strong>{{end_date}}</strong>. The confidentiality obligations shall survive termination for a period of two (2) years.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">4. GOVERNING LAW & JURISDICTION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Agreement shall be governed by applicable laws. Any disputes arising shall be resolved through binding arbitration in the jurisdiction of the Disclosing Party.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="display:flex;gap:60px;margin-top:40px;">
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Disclosing Party</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Receiving Party</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
</div>
</div>`,
  },
  {
    name: 'Legal Services Agreement',
    type: 'contract',
    category: 'Legal / Immigration',
    description: 'Scope, fees, retainer, billing, and termination for law firms',
    blocks: [
      { id: 'h5', type: 'header', content: '{{company_name}}' },
      { id: 't5a', type: 'text', content: 'LEGAL SERVICES AGREEMENT' },
      { id: 'd5a', type: 'divider', content: '' },
      { id: 't5b', type: 'text', content: 'This Agreement for Legal Services is entered into by {{company_name}} ("Firm") and {{client_name}} ("Client") as of {{start_date}}.' },
      { id: 't5c', type: 'text', content: '1. SCOPE — The Firm agrees to provide legal services as described in the engagement letter attached hereto.' },
      { id: 't5d', type: 'text', content: '2. FEES & RETAINER — Client shall pay a retainer of {{value}} upon execution of this Agreement. Services will be billed at the agreed hourly rate.' },
      { id: 't5e', type: 'text', content: '3. BILLING — Invoices will be issued monthly. Payment is due within 15 days of invoice date.' },
      { id: 't5f', type: 'text', content: '4. TERMINATION — Either party may terminate with 30 days written notice. Client remains responsible for fees incurred through termination date.' },
      { id: 'd5b', type: 'divider', content: '' },
      { id: 'sig5a', type: 'signature', content: 'Firm Representative' },
      { id: 'sig5b', type: 'signature', content: 'Client' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px double #1e293b;">
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  <h2 style="font-size:18px;font-weight:800;color:#1e293b;margin:20px 0 0 0;letter-spacing:2px;">LEGAL SERVICES AGREEMENT</h2>
</div>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Agreement for Legal Services ("Agreement") is entered into as of <strong>{{start_date}}</strong> by and between <strong>{{company_name}}</strong> ("Firm") and <strong>{{client_name}}</strong> ("Client").</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">1. SCOPE OF SERVICES</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">The Firm agrees to provide legal services as described in the engagement letter attached hereto or as otherwise agreed in writing between the parties.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">2. FEES & RETAINER</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Client shall pay an initial retainer of <strong>{{value}}</strong> upon execution of this Agreement. The retainer will be applied against fees and costs incurred. Services will be billed at the Firm's standard hourly rates.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">3. BILLING & PAYMENT</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Invoices will be issued monthly and are due within 15 days. Unpaid balances may accrue interest at 1.5% per month. The Firm reserves the right to suspend services for overdue accounts.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">4. TERMINATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Either party may terminate this Agreement with 30 days written notice. Client remains responsible for all fees and costs incurred through the termination date. Unused retainer will be refunded.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="display:flex;gap:60px;margin-top:40px;">
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Firm Representative</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Client: {{client_name}}</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
</div>
</div>`,
  },
  {
    name: 'Power of Attorney',
    type: 'contract',
    category: 'Legal / Immigration',
    description: 'Grantor, attorney-in-fact, powers granted, duration, signatures',
    blocks: [
      { id: 'h6', type: 'header', content: '{{company_name}}' },
      { id: 't6a', type: 'text', content: 'POWER OF ATTORNEY' },
      { id: 'd6a', type: 'divider', content: '' },
      { id: 't6b', type: 'text', content: 'I, {{client_name}} ("Grantor"), hereby appoint {{company_name}} ("Attorney-in-Fact") to act on my behalf.' },
      { id: 't6c', type: 'text', content: 'POWERS GRANTED: The Attorney-in-Fact is authorized to execute documents, manage accounts, and represent the Grantor in legal proceedings as specified.' },
      { id: 't6d', type: 'text', content: 'DURATION: This Power of Attorney is effective from {{start_date}} and shall remain in effect until {{end_date}} or until revoked in writing.' },
      { id: 'd6b', type: 'divider', content: '' },
      { id: 'sig6a', type: 'signature', content: 'Grantor: {{client_name}}' },
      { id: 'sig6b', type: 'signature', content: 'Attorney-in-Fact' },
      { id: 'sig6c', type: 'signature', content: 'Witness' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px double #1e293b;">
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  <h2 style="font-size:20px;font-weight:800;color:#1e293b;margin:20px 0 0 0;letter-spacing:3px;">POWER OF ATTORNEY</h2>
</div>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">I, <strong>{{client_name}}</strong> ("Grantor"), of legal age and sound mind, hereby appoint <strong>{{company_name}}</strong> ("Attorney-in-Fact") to act on my behalf in the matters described below.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">POWERS GRANTED</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">The Attorney-in-Fact is hereby authorized to:<br/>
(a) Execute and sign documents on behalf of the Grantor;<br/>
(b) Manage financial accounts and transactions;<br/>
(c) Represent the Grantor in legal and administrative proceedings;<br/>
(d) Take any and all actions reasonably necessary to carry out the above powers.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">DURATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">This Power of Attorney is effective from <strong>{{start_date}}</strong> and shall remain in effect until <strong>{{end_date}}</strong>, or until revoked in writing by the Grantor.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">REVOCATION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">The Grantor reserves the right to revoke this Power of Attorney at any time by providing written notice to the Attorney-in-Fact.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="margin-top:40px;">
  <div style="margin-bottom:30px;"><div style="border-top:1px solid #1e293b;width:300px;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Grantor: {{client_name}}</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
  <div style="margin-bottom:30px;"><div style="border-top:1px solid #1e293b;width:300px;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Attorney-in-Fact</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
  <div><div style="border-top:1px solid #1e293b;width:300px;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Witness</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
</div>
</div>`,
  },
  // ---- BEAUTY / AESTHETICS ----
  {
    name: 'Appointment Confirmation',
    type: 'custom',
    category: 'Beauty / Aesthetics',
    description: 'Client name, service, date/time, location, preparation, cancellation policy',
    blocks: [
      { id: 'h7', type: 'header', content: '{{company_name}}' },
      { id: 't7a', type: 'text', content: 'Your appointment has been confirmed!' },
      { id: 'ci7', type: 'client_info', content: '{{client_name}}' },
      { id: 't7b', type: 'text', content: 'Service: Your selected treatment\nDate & Time: {{date}}\nLocation: {{company_address}}' },
      { id: 'd7', type: 'divider', content: '' },
      { id: 't7c', type: 'text', content: 'Preparation: Please arrive 10 minutes early. Avoid wearing makeup or applying products to the treatment area.' },
      { id: 'te7', type: 'terms', content: 'Cancellation Policy: Please notify us at least 24 hours in advance to cancel or reschedule. Late cancellations may incur a fee of 50% of the service cost.' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;">
  <div style="width:60px;height:60px;background:#fdf2f8;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 12px;">&#10003;</div>
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
</div>
<div style="background:#fdf2f8;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px;">
  <h2 style="font-size:18px;font-weight:700;color:#be185d;margin:0;">Appointment Confirmed</h2>
  <p style="color:#64748b;font-size:13px;margin-top:4px;">We look forward to seeing you!</p>
</div>
<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px;">
  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Client</p>
  <p style="font-weight:600;margin:0;font-size:14px;">{{client_name}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">{{client_email}}</p>
</div>
<div style="background:white;border:1px solid #e2e8f0;padding:20px;border-radius:8px;margin-bottom:20px;">
  <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
    <span style="font-size:13px;color:#64748b;">Service</span>
    <span style="font-size:13px;font-weight:600;">Your selected treatment</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
    <span style="font-size:13px;color:#64748b;">Date & Time</span>
    <span style="font-size:13px;font-weight:600;">{{date}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;">
    <span style="font-size:13px;color:#64748b;">Location</span>
    <span style="font-size:13px;font-weight:600;">{{company_address}}</span>
  </div>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<h3 style="font-size:14px;font-weight:700;color:#1e293b;margin:0 0 8px 0;">Preparation Instructions</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">Please arrive 10 minutes early. Avoid wearing makeup or applying products to the treatment area. Wear comfortable clothing.</div>
<div style="font-size:10px;line-height:1.5;color:#94a3b8;background:#fef2f2;padding:12px;border-radius:8px;"><strong style="color:#ef4444;">Cancellation Policy:</strong> Please notify us at least 24 hours in advance to cancel or reschedule. Late cancellations may incur a fee of 50% of the service cost.</div>
</div>`,
  },
  {
    name: 'Treatment Consent Form',
    type: 'custom',
    category: 'Beauty / Aesthetics',
    description: 'Client info, procedure description, risks, consent statement, signature',
    blocks: [
      { id: 'h8', type: 'header', content: '{{company_name}}' },
      { id: 't8a', type: 'text', content: 'TREATMENT CONSENT FORM' },
      { id: 'ci8', type: 'client_info', content: '{{client_name}}' },
      { id: 'd8a', type: 'divider', content: '' },
      { id: 't8b', type: 'text', content: 'Procedure: [Description of the treatment to be performed]' },
      { id: 't8c', type: 'text', content: 'Risks: As with any cosmetic or aesthetic procedure, there are inherent risks including but not limited to allergic reactions, temporary redness, swelling, and in rare cases, scarring.' },
      { id: 't8d', type: 'text', content: 'I, {{client_name}}, hereby consent to the above procedure. I confirm that I have been informed of the risks and have had the opportunity to ask questions. I understand that results may vary.' },
      { id: 'd8b', type: 'divider', content: '' },
      { id: 'sig8a', type: 'signature', content: 'Client: {{client_name}}' },
      { id: 'sig8b', type: 'signature', content: 'Practitioner' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
  <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  <h2 style="font-size:18px;font-weight:700;color:#be185d;margin:20px 0 0 0;">TREATMENT CONSENT FORM</h2>
</div>
<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px;">
  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Client Information</p>
  <p style="font-weight:600;margin:0;font-size:14px;">{{client_name}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">{{client_email}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">Date: {{date}}</p>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">PROCEDURE DESCRIPTION</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;background:#f8fafc;padding:16px;border-radius:8px;">[Description of the treatment to be performed — edit this section for each client]</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">RISKS & SIDE EFFECTS</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;">As with any cosmetic or aesthetic procedure, there are inherent risks including but not limited to: allergic reactions, temporary redness, swelling, bruising, infection, and in rare cases, scarring or pigmentation changes. Results may vary between individuals.</div>
<h3 style="font-size:14px;font-weight:700;color:#1e293b;">CONSENT STATEMENT</h3>
<div style="margin-bottom:20px;font-size:14px;line-height:1.7;color:#334155;background:#f0fdf4;padding:16px;border-radius:8px;border:1px solid #bbf7d0;">I, <strong>{{client_name}}</strong>, hereby consent to the above procedure. I confirm that I have been informed of the potential risks and side effects, have had the opportunity to ask questions, and understand that results may vary.</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="display:flex;gap:60px;margin-top:40px;">
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Client: {{client_name}}</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
  <div style="flex:1;"><div style="border-top:1px solid #1e293b;padding-top:8px;"><p style="font-size:12px;color:#64748b;margin:0;">Practitioner</p><p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;">Date: _______________</p></div></div>
</div>
</div>`,
  },
  {
    name: 'Gift Certificate',
    type: 'custom',
    category: 'Beauty / Aesthetics',
    description: 'Recipient, amount/service, expiry, terms',
    blocks: [
      { id: 'h9', type: 'header', content: '{{company_name}}' },
      { id: 't9a', type: 'text', content: 'GIFT CERTIFICATE' },
      { id: 'd9a', type: 'divider', content: '' },
      { id: 't9b', type: 'text', content: 'This certificate entitles {{client_name}} to services valued at {{total}}.' },
      { id: 't9c', type: 'text', content: 'Valid until: {{valid_until}}' },
      { id: 'te9', type: 'terms', content: 'This certificate is non-transferable and cannot be redeemed for cash. Must be presented at time of service. Expired certificates will not be honored.' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="background:linear-gradient(135deg,#0891B2 0%,#a855f7 100%);color:white;padding:40px;border-radius:16px;text-align:center;margin-bottom:24px;">
  <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;margin:0 0 8px 0;opacity:0.8;">{{company_name}}</p>
  <h1 style="font-size:32px;font-weight:800;margin:0;">Gift Certificate</h1>
  <div style="width:60px;height:2px;background:rgba(255,255,255,0.5);margin:16px auto;"></div>
  <p style="font-size:14px;opacity:0.9;margin:0;">A special gift for</p>
  <h2 style="font-size:24px;font-weight:700;margin:8px 0 0 0;">{{client_name}}</h2>
</div>
<div style="text-align:center;padding:24px;background:#f8fafc;border-radius:12px;margin-bottom:20px;">
  <p style="font-size:12px;color:#94a3b8;text-transform:uppercase;margin:0 0 4px 0;">Value</p>
  <p style="font-size:36px;font-weight:800;color:#0891B2;margin:0;">{{total}}</p>
  <p style="font-size:12px;color:#64748b;margin:8px 0 0 0;">Valid until: {{valid_until}}</p>
</div>
<div style="text-align:center;margin-bottom:16px;">
  <p style="font-size:12px;color:#64748b;">Certificate #: {{reference}}</p>
</div>
<div style="font-size:10px;line-height:1.5;color:#94a3b8;text-align:center;">This certificate is non-transferable and cannot be redeemed for cash. Must be presented at time of service. Expired certificates will not be honored. {{company_name}} reserves the right to modify available services.</div>
</div>`,
  },
  // ---- GENERAL ----
  {
    name: 'Payment Receipt',
    type: 'receipt',
    category: 'General',
    description: 'Simple receipt with company info, amount, method, date, reference',
    blocks: [
      { id: 'h10', type: 'header', content: '{{company_name}}' },
      { id: 'ci10', type: 'client_info', content: '{{client_name}}' },
      { id: 'd10a', type: 'divider', content: '' },
      { id: 't10a', type: 'text', content: 'Payment received. Thank you!' },
      { id: 'to10', type: 'totals', content: '{{amount}}' },
      { id: 'te10', type: 'terms', content: 'This receipt confirms payment has been received. Please retain for your records.' },
    ],
    html_content: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:40px;color:#1e293b;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #e2e8f0;">
  <div>
    <div style="width:60px;height:60px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#0891B2;margin-bottom:8px;">LOGO</div>
    <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0;">{{company_name}}</h1>
    <p style="color:#64748b;font-size:12px;margin-top:2px;">{{company_address}}</p>
  </div>
  <div style="text-align:right;">
    <h2 style="font-size:24px;font-weight:800;color:#16a34a;margin:0;">RECEIPT</h2>
    <p style="color:#64748b;font-size:12px;">{{reference}}</p>
    <p style="color:#64748b;font-size:12px;">{{payment_date}}</p>
  </div>
</div>
<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px;">
  <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Received From</p>
  <p style="font-weight:600;margin:0;font-size:14px;">{{client_name}}</p>
  <p style="color:#64748b;font-size:12px;margin:2px 0 0 0;">{{client_email}}</p>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<div style="background:#f0fdf4;padding:24px;border-radius:12px;text-align:center;margin-bottom:20px;border:1px solid #bbf7d0;">
  <p style="font-size:12px;color:#16a34a;text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Payment Received</p>
  <p style="font-size:32px;font-weight:800;color:#16a34a;margin:0;">{{amount}}</p>
</div>
<div style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:8px;margin-bottom:20px;">
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
    <span style="font-size:13px;color:#64748b;">Payment Method</span>
    <span style="font-size:13px;font-weight:600;">{{method}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
    <span style="font-size:13px;color:#64748b;">Date</span>
    <span style="font-size:13px;font-weight:600;">{{payment_date}}</span>
  </div>
  <div style="display:flex;justify-content:space-between;">
    <span style="font-size:13px;color:#64748b;">Reference</span>
    <span style="font-size:13px;font-weight:600;">{{reference}}</span>
  </div>
</div>
<div style="font-size:10px;line-height:1.5;color:#94a3b8;text-align:center;">This receipt confirms payment has been received. Please retain for your records. For questions, contact {{company_name}}.</div>
</div>`,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TemplatesPage() {
  const { t } = useI18n()
  const supabase = createClient()
  const [templates, setTemplates] = useState<DbRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<DbRow | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [form, setForm] = useState({ name: '', type: 'invoice', html_content: '', blocks: [] as Block[] })
  const [preview, setPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editorTab, setEditorTab] = useState<'visual' | 'advanced'>('visual')
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [libraryFilter, setLibraryFilter] = useState<string>('all')
  const [installedMessage, setInstalledMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    const { data } = await supabase.from('document_templates').select('*').eq('workspace_id', ws.id).order('name')
    setTemplates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Generate HTML from blocks
  const generateHTML = (blocks: Block[]): string => {
    if (blocks.length === 0) return ''
    return blocksToHTML(blocks)
  }

  // Sync blocks -> html_content
  const updateBlocks = (blocks: Block[]) => {
    setForm(f => ({ ...f, blocks, html_content: generateHTML(blocks) }))
  }

  const saveTemplate = async () => {
    if (!form.name) return
    setSaving(true)
    const html = editorTab === 'visual' ? generateHTML(form.blocks) : form.html_content
    const vars = (html.match(/\{\{(\w+)\}\}/g) || [])
    const payload = {
      name: form.name,
      type: form.type,
      html_content: html,
      variables: vars,
      metadata: editorTab === 'visual' ? { blocks: form.blocks } : undefined,
    }
    if (editing) {
      await supabase.from('document_templates').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('document_templates').insert({ workspace_id: workspaceId, ...payload })
    }
    setForm({ name: '', type: 'invoice', html_content: '', blocks: [] })
    setShowNew(false); setEditing(null); setSaving(false)
    toast.success(t('settings.tpl.saved'))
    load()
  }

  const editTemplate = (t: DbRow) => {
    setEditing(t)
    const blocks: Block[] = t.metadata?.blocks || []
    setForm({ name: t.name, type: t.type, html_content: t.html_content, blocks })
    setEditorTab(blocks.length > 0 ? 'visual' : 'advanced')
    setShowNew(true)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm(t('settings.tpl.delete_confirm'))) return
    await supabase.from('document_templates').delete().eq('id', id)
    toast.success(t('settings.tpl.deleted'))
    load()
  }

  const installLibraryTemplate = async (lt: LibraryTemplate) => {
    if (!workspaceId) return
    const vars = (lt.html_content.match(/\{\{(\w+)\}\}/g) || [])
    await supabase.from('document_templates').insert({
      workspace_id: workspaceId,
      name: lt.name,
      type: lt.type,
      html_content: lt.html_content,
      variables: vars,
      metadata: { blocks: lt.blocks },
    })
    toast.success(t('settings.tpl.installed_msg'))
    setInstalledMessage(lt.name)
    setTimeout(() => setInstalledMessage(null), 2000)
    load()
  }

  // Block operations
  const moveBlock = (idx: number, dir: -1 | 1) => {
    const newBlocks = [...form.blocks]
    const target = idx + dir
    if (target < 0 || target >= newBlocks.length) return
    ;[newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]]
    updateBlocks(newBlocks)
  }

  const deleteBlock = (idx: number) => {
    const newBlocks = form.blocks.filter((_, i) => i !== idx)
    updateBlocks(newBlocks)
  }

  const updateBlockContent = (idx: number, content: string) => {
    const newBlocks = [...form.blocks]
    newBlocks[idx] = { ...newBlocks[idx], content }
    updateBlocks(newBlocks)
  }

  const addBlock = (type: BlockType) => {
    const newBlock: Block = { id: uid(), type, content: defaultBlockContent(type) }
    updateBlocks([...form.blocks, newBlock])
    setShowBlockPicker(false)
    setExpandedBlock(newBlock.id)
  }

  // PDF / Print
  const openPrintPreview = (html: string, data?: Record<string, string>) => {
    const rendered = renderTemplate(sanitizeHTML(html), data || SAMPLE_DATA)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Print Preview</title><style>@media print{body{margin:0}}</style></head><body>${rendered}</body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // Email
  const openEmailWithTemplate = (html: string, templateName: string) => {
    const rendered = renderTemplate(sanitizeHTML(html), SAMPLE_DATA)
    // Store in sessionStorage for the email composer to pick up
    sessionStorage.setItem('template_email_body', rendered)
    sessionStorage.setItem('template_email_subject', templateName)
    toast.success(t('settings.tpl.copied_msg'))
  }

  // WhatsApp
  const openWhatsAppWithTemplate = (templateName: string) => {
    const text = `Hi! I've prepared a document for you: ${templateName}. Please check your email for the full document.`
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  // Categories for library
  const categories = Array.from(new Set(TEMPLATE_LIBRARY.map(t => t.category)))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>

  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pages.templates')}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{templates.length} {t('settings.tpl.count_suffix')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLibrary(true)} className="btn-secondary btn-sm">
            <Sparkles className="w-3.5 h-3.5" /> {t('settings.tpl.library_btn')}
          </button>
          <button onClick={() => {
            setEditing(null)
            setForm({ name: '', type: 'invoice', html_content: '', blocks: [
              { id: uid(), type: 'header', content: '{{company_name}}' },
              { id: uid(), type: 'client_info', content: '{{client_name}}' },
              { id: uid(), type: 'items_table', content: '{{items_table}}' },
              { id: uid(), type: 'totals', content: '{{subtotal}} / {{tax}} / {{total}}' },
            ] })
            setEditorTab('visual')
            setShowNew(true)
          }} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> {t('settings.tpl.new_template')}
          </button>
        </div>
      </div>

      {/* Template grid */}
      {templates.length === 0 ? (
        <div className="card text-center py-16">
          <FileText className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <p className="text-surface-500">{t('settings.tpl.empty')}</p>
          <p className="text-xs text-surface-400 mt-1">{t('settings.tpl.empty_hint')}</p>
          <button onClick={() => setShowLibrary(true)} className="btn-primary btn-sm mt-4">
            <Sparkles className="w-3.5 h-3.5" /> {t('settings.tpl.browse_library')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="card p-4 hover:shadow-card-hover transition-all group">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-surface-900">{tpl.name}</h3>
                  <p className="text-[10px] text-surface-400 capitalize">{tpl.type}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openPrintPreview(tpl.html_content)} title={t('settings.tpl.generate_pdf')} className="text-surface-300 hover:text-brand-600"><Printer className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openEmailWithTemplate(tpl.html_content, tpl.name)} title={t('settings.tpl.email')} className="text-surface-300 hover:text-brand-600"><Mail className="w-3.5 h-3.5" /></button>
                  <button onClick={() => openWhatsAppWithTemplate(tpl.name)} title={t('settings.tpl.whatsapp')} className="text-surface-300 hover:text-green-600"><MessageCircle className="w-3.5 h-3.5" /></button>
                  <button onClick={() => editTemplate(tpl)} title={t('settings.tpl.edit_template')} className="text-surface-300 hover:text-brand-600"><FileText className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteTemplate(tpl.id)} title={t('common.delete')} className="text-surface-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="h-28 bg-surface-50 rounded-lg overflow-hidden text-[6px] p-2 leading-tight text-surface-400" dangerouslySetInnerHTML={{ __html: sanitizeHTML(tpl.html_content.slice(0, 600)) }} />
              <div className="flex items-center justify-between mt-2">
                {tpl.variables?.length > 0 && <p className="text-[9px] text-surface-300">{tpl.variables.length} {t('settings.tpl.variables_count')}</p>}
                <button onClick={() => openPrintPreview(tpl.html_content)} className="text-[10px] text-brand-600 hover:text-brand-700 font-medium">
                  {t('settings.tpl.use_template')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template Library Modal */}
      {showLibrary && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-surface-100">
              <div>
                <h2 className="font-semibold text-surface-900">{t('settings.tpl.library_title')}</h2>
                <p className="text-xs text-surface-400 mt-0.5">{t('settings.tpl.library_desc')}</p>
              </div>
              <button onClick={() => setShowLibrary(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                <X className="w-4 h-4 text-surface-500" />
              </button>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 p-4 border-b border-surface-100 overflow-x-auto">
              <button onClick={() => setLibraryFilter('all')} className={cn('text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors', libraryFilter === 'all' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                {t('settings.tpl.all_templates')}
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setLibraryFilter(cat)} className={cn('text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors', libraryFilter === cat ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200')}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TEMPLATE_LIBRARY.filter(lib => libraryFilter === 'all' || lib.category === libraryFilter).map((lt, i) => (
                  <div key={i} className="border border-surface-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-surface-900">{lt.name}</h3>
                        <p className="text-[10px] text-surface-400">{lt.category} &middot; {lt.type}</p>
                      </div>
                      <button
                        onClick={() => installLibraryTemplate(lt)}
                        className={cn('btn-sm text-xs', installedMessage === lt.name ? 'btn-secondary text-green-600' : 'btn-primary')}
                      >
                        {installedMessage === lt.name ? <><Check className="w-3 h-3" /> {t('settings.tpl.installed')}</> : <><Download className="w-3 h-3" /> {t('settings.tpl.install')}</>}
                      </button>
                    </div>
                    <p className="text-xs text-surface-500 mb-3">{lt.description}</p>
                    <div className="h-24 bg-surface-50 rounded-lg overflow-hidden text-[5px] p-2 leading-tight text-surface-400" dangerouslySetInnerHTML={{ __html: sanitizeHTML(lt.html_content.slice(0, 500)) }} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openPrintPreview(lt.html_content)} className="text-[10px] text-surface-400 hover:text-brand-600 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {t('settings.tpl.preview')}
                      </button>
                      <button onClick={() => {
                        setEditing(null)
                        setForm({ name: lt.name, type: lt.type, html_content: lt.html_content, blocks: lt.blocks })
                        setEditorTab('visual')
                        setShowLibrary(false)
                        setShowNew(true)
                      }} className="text-[10px] text-surface-400 hover:text-brand-600 flex items-center gap-1">
                        <Copy className="w-3 h-3" /> {t('settings.tpl.customize')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-surface-900">{editing ? t('settings.tpl.edit_template') : t('settings.tpl.new_template_title')}</h2>
                {/* Editor mode tabs */}
                <div className="flex bg-surface-100 rounded-lg p-0.5">
                  <button onClick={() => setEditorTab('visual')} className={cn('text-[10px] px-3 py-1 rounded-md transition-colors flex items-center gap-1', editorTab === 'visual' ? 'bg-white text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                    <LayoutGrid className="w-3 h-3" /> {t('settings.tpl.visual')}
                  </button>
                  <button onClick={() => {
                    if (editorTab === 'visual' && form.blocks.length > 0) {
                      setForm(f => ({ ...f, html_content: generateHTML(f.blocks) }))
                    }
                    setEditorTab('advanced')
                  }} className={cn('text-[10px] px-3 py-1 rounded-md transition-colors flex items-center gap-1', editorTab === 'advanced' ? 'bg-white text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-700')}>
                    <Code className="w-3 h-3" /> {t('settings.tpl.advanced')}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPreview(!preview)} className={cn('btn-ghost btn-sm text-[10px]', preview && 'bg-brand-50 text-brand-600')}>
                  <Eye className="w-3 h-3" /> {t('settings.tpl.preview')}
                </button>
                <button onClick={() => openPrintPreview(editorTab === 'visual' ? generateHTML(form.blocks) : form.html_content)} className="btn-ghost btn-sm text-[10px]">
                  <Printer className="w-3 h-3" /> {t('settings.tpl.pdf')}
                </button>
                <button onClick={() => { setShowNew(false); setEditing(null) }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-100">
                  <X className="w-4 h-4 text-surface-500" />
                </button>
              </div>
            </div>

            {/* Name and type */}
            <div className="p-3 border-b border-surface-100 flex-shrink-0">
              <div className="flex gap-2">
                <input className="input text-xs flex-1" placeholder={t('settings.tpl.template_name_placeholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <select className="input text-xs w-36" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TEMPLATE_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* VISUAL EDITOR */}
              {editorTab === 'visual' && (
                <div className={cn('flex flex-col overflow-hidden', preview ? 'w-1/2' : 'flex-1')}>
                  {/* Block list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {form.blocks.length === 0 && (
                      <div className="text-center py-12 text-surface-400">
                        <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('settings.tpl.no_blocks')}</p>
                        <p className="text-xs mt-1">{t('settings.tpl.no_blocks_hint')}</p>
                      </div>
                    )}
                    {form.blocks.map((block, idx) => (
                      <div key={block.id} className={cn('border rounded-xl transition-all', expandedBlock === block.id ? 'border-brand-300 bg-brand-50/30 shadow-sm' : 'border-surface-200 hover:border-surface-300')}>
                        <div className="flex items-center gap-2 p-2.5">
                          <GripVertical className="w-3.5 h-3.5 text-surface-300 flex-shrink-0" />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-[10px] px-1.5 py-0.5 bg-surface-100 text-surface-500 rounded font-medium uppercase">{block.type}</span>
                            <span className="text-xs text-surface-600 truncate">{block.content.slice(0, 50)}{block.content.length > 50 ? '...' : ''}</span>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-200 disabled:opacity-30">
                              <ChevronUp className="w-3 h-3 text-surface-500" />
                            </button>
                            <button onClick={() => moveBlock(idx, 1)} disabled={idx === form.blocks.length - 1} className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-200 disabled:opacity-30">
                              <ChevronDown className="w-3 h-3 text-surface-500" />
                            </button>
                            <button onClick={() => setExpandedBlock(expandedBlock === block.id ? null : block.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-200">
                              <PenLine className="w-3 h-3 text-surface-500" />
                            </button>
                            <button onClick={() => deleteBlock(idx)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50">
                              <Trash2 className="w-3 h-3 text-surface-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                        {/* Expanded edit */}
                        {expandedBlock === block.id && block.type !== 'divider' && (
                          <div className="px-3 pb-3 pt-1 border-t border-surface-100">
                            {block.type === 'items_table' ? (
                              <p className="text-xs text-surface-400 italic">{t('settings.tpl.items_table_note')}</p>
                            ) : block.type === 'totals' ? (
                              <p className="text-xs text-surface-400 italic">{t('settings.tpl.totals_note')}</p>
                            ) : (
                              <div
                                className="text-xs min-h-[60px] p-2 rounded-lg bg-white border border-surface-200 focus:border-brand-300 focus:ring-1 focus:ring-brand-200 outline-none"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={e => updateBlockContent(idx, e.currentTarget.textContent || '')}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                              />
                            )}
                            {/* Variable chips for text blocks */}
                            {(block.type === 'text' || block.type === 'header' || block.type === 'terms' || block.type === 'signature') && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(VARIABLES[form.type] || VARIABLES.custom).map(v => (
                                  <button key={v} onClick={() => updateBlockContent(idx, block.content + ' ' + v)} className="text-[9px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100">{v}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add block button */}
                    <div className="relative">
                      <button onClick={() => setShowBlockPicker(!showBlockPicker)} className="w-full border-2 border-dashed border-surface-200 rounded-xl py-3 text-xs text-surface-400 hover:border-brand-300 hover:text-brand-500 transition-colors flex items-center justify-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> {t('settings.tpl.add_block')}
                      </button>
                      {showBlockPicker && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-surface-200 rounded-xl shadow-lg p-2 z-10">
                          <div className="grid grid-cols-2 gap-1">
                            {BLOCK_TYPES.map(bt => (
                              <button key={bt.value} onClick={() => addBlock(bt.value)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-50 text-left transition-colors">
                                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">{bt.icon}</div>
                                <div>
                                  <p className="text-xs font-medium text-surface-900">{bt.label}</p>
                                  <p className="text-[9px] text-surface-400">{bt.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ADVANCED (raw HTML) EDITOR */}
              {editorTab === 'advanced' && (
                <div className={cn('flex flex-col', preview ? 'w-1/2' : 'flex-1')}>
                  <div className="p-2 border-b border-surface-100">
                    <div className="flex flex-wrap gap-1">
                      {(VARIABLES[form.type] || VARIABLES.custom).map(v => (
                        <button key={v} onClick={() => {
                          const el = document.getElementById('template-editor') as HTMLTextAreaElement
                          if (el) {
                            const pos = el.selectionStart
                            const before = form.html_content.slice(0, pos)
                            const after = form.html_content.slice(pos)
                            setForm(f => ({ ...f, html_content: before + v + after }))
                          }
                        }} className="text-[9px] px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded font-mono hover:bg-brand-100">{v}</button>
                      ))}
                    </div>
                  </div>
                  <textarea id="template-editor" className="flex-1 p-3 text-xs font-mono resize-none outline-none border-none"
                    value={form.html_content} onChange={e => setForm(f => ({ ...f, html_content: e.target.value }))} />
                </div>
              )}

              {/* Preview side */}
              {preview && (
                <div className="w-1/2 border-l border-surface-100 overflow-y-auto bg-white p-4">
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderTemplate(
                    editorTab === 'visual' ? generateHTML(form.blocks) : form.html_content,
                    SAMPLE_DATA
                  )) }} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 p-4 border-t border-surface-100 flex-shrink-0">
              <button onClick={() => { setShowNew(false); setEditing(null) }} className="btn-secondary flex-1">{t('settings.tpl.cancel')}</button>
              <button onClick={() => openPrintPreview(editorTab === 'visual' ? generateHTML(form.blocks) : form.html_content)} className="btn-ghost flex items-center justify-center gap-1.5 px-4">
                <Printer className="w-3.5 h-3.5" /> {t('settings.tpl.generate_pdf')}
              </button>
              <button onClick={() => openEmailWithTemplate(editorTab === 'visual' ? generateHTML(form.blocks) : form.html_content, form.name || 'Document')} className="btn-ghost flex items-center justify-center gap-1.5 px-4">
                <Mail className="w-3.5 h-3.5" /> {t('settings.tpl.email')}
              </button>
              <button onClick={() => openWhatsAppWithTemplate(form.name || 'Document')} className="btn-ghost flex items-center justify-center gap-1.5 px-4">
                <MessageCircle className="w-3.5 h-3.5" /> {t('settings.tpl.whatsapp')}
              </button>
              <button onClick={saveTemplate} disabled={!form.name || saving} className="btn-primary flex-1">
                <Save className="w-3.5 h-3.5" /> {t('settings.tpl.save_template')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
