'use client'
import { toast } from 'sonner'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, Database, Loader2, Package, Users, TrendingUp, Sparkles, Brain } from 'lucide-react'
import { sanitizeForInsert } from '@/lib/db/safe-query'
import { cn } from '@/lib/utils'

interface DetectedTable {
  name: string; rows: Record<string, any>[]; headers: string[]
  mappedTo: string; fieldMapping: Record<string, string>; notes: string
}
const ENTITY_ICONS: Record<string, any> = { contacts: Users, products: Package, deals: TrendingUp, companies: Users }

export default function ImportPage() {
  const supabase = createClient()
  const [tables, setTables] = useState<DetectedTable[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'importing' | 'done'>('upload')
  const [progress, setProgress] = useState({ current: 0, total: 0, table: '' })

  const parseFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)
    let detected: DetectedTable[] = []
    try {
      if (ext === 'base') {
        const data = JSON.parse(await file.text())
        const binary = atob(data.gzipSnapshot)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ds = new DecompressionStream('gzip')
        const w = ds.writable.getWriter(); w.write(bytes); w.close()
        const r = ds.readable.getReader(); const chunks: Uint8Array[] = []
        while (true) { const { done, value } = await r.read(); if (done) break; chunks.push(value) }
        const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
        let off = 0; for (const c of chunks) { total.set(c, off); off += c.length }
        const items = JSON.parse(new TextDecoder().decode(total))
        const arr = Array.isArray(items) ? items : [items]
        const seen = new Set<string>()
        for (const item of arr) {
          const sd = item?.schema?.data; if (!sd) continue
          const fm = sd.table?.fieldMap || {}; const rm = sd.recordMap || {}
          const f2n: Record<string, string> = {}
          for (const [fid, f] of Object.entries(fm)) f2n[fid] = (f as any).name || fid
          const headers = Object.values(f2n); const rows: Record<string, any>[] = []
          for (const [, rec] of Object.entries(rm)) {
            const row: Record<string, any> = {}
            for (const [fid, cell] of Object.entries(rec as any)) {
              if (!cell || typeof cell !== 'object') continue
              const fn = f2n[fid] || fid; const val = (cell as any).value
              if (val == null) continue
              row[fn] = Array.isArray(val) ? val.map((v: any) => typeof v === 'object' ? (v.text || v.name || '') : String(v)).filter(Boolean).join('; ') : val
            }
            if (Object.keys(row).length > 0) rows.push(row)
          }
          if (!rows.length) continue
          const key = headers.sort().join(','); if (seen.has(key)) continue; seen.add(key)
          detected.push({ name: `Table (${rows.length} rows)`, rows, headers, mappedTo: 'skip', fieldMapping: {}, notes: '' })
        }
      } else if (ext === 'csv') {
        const text = await file.text(); const lines = text.split('\n').filter(l => l.trim())
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'))
        const rows = lines.slice(1).map(line => { const vals: string[] = []; let cur = ''; let q = false
          for (const c of line) { if (c === '"') { q = !q; continue }; if (c === ',' && !q) { vals.push(cur.trim()); cur = ''; continue }; cur += c }
          vals.push(cur.trim()); const row: Record<string, any> = {}; headers.forEach((h, i) => { if (vals[i]) row[h] = vals[i] }); return row
        }).filter(r => Object.values(r).some(v => v))
        detected = [{ name: file.name, rows, headers, mappedTo: 'contacts', fieldMapping: {}, notes: '' }]
      } else if (ext === 'json') {
        const d = JSON.parse(await file.text()); const rows = Array.isArray(d) ? d : d.data || [d]
        detected = [{ name: file.name, rows, headers: rows[0] ? Object.keys(rows[0]) : [], mappedTo: 'contacts', fieldMapping: {}, notes: '' }]
      }
    } catch { toast.error('Failed to parse file'); return }
    if (!detected.length) { toast.error('No data found'); return }
    setTables(detected); setStep('analyzing')

    // AI analysis
    try {
      const res = await fetch('/api/ai/analyze-import', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: detected.map(t => ({ name: t.name, headers: t.headers, rows: t.rows.slice(0, 3) })) }) })
      if (res.ok) {
        const { analysis } = await res.json()
        if (Array.isArray(analysis)) {
          setTables(detected.map((t, i) => {
            const ai = analysis[i]; if (!ai) return t
            return { ...t, name: ai.tableName || t.name, mappedTo: ai.mappedTo || 'skip', fieldMapping: ai.fieldMapping || {}, notes: ai.notes || '' }
          }))
          toast.success('AI analysis complete')
        }
      } else { fallbackDetect(detected) }
    } catch { fallbackDetect(detected) }
    setStep('review')
  }

  const fallbackDetect = (detected: DetectedTable[]) => {
    setTables(detected.map(t => {
      const f = t.headers.join(' ').toLowerCase(); let m = 'skip'
      if (f.includes('company name') || f.includes('industry') || f.includes('client type')) m = 'companies'
      else if (f.includes('full name') || (f.includes('email') && f.includes('phone'))) m = 'contacts'
      else if (f.includes('price') || f.includes('capacity') || f.includes('weight') || f.includes('product')) m = 'products'
      else if (f.includes('project') || f.includes('budget') || f.includes('status') || f.includes('order') || f.includes('mwh') || f.includes('mw')) m = 'deals'
      return { ...t, mappedTo: m }
    }))
  }

  const doImport = async () => {
    setStep('importing'); setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return
    const results: any = {}
    for (const entityType of ['companies', 'contacts', 'products', 'deals']) {
      const toImport = tables.filter(t => t.mappedTo === entityType); if (!toImport.length) continue
      let imported = 0, skipped = 0
      for (const table of toImport) {
        const fm = table.fieldMapping; setProgress({ current: 0, total: table.rows.length, table: table.name })
        for (let i = 0; i < table.rows.length; i++) {
          const row = table.rows[i]; if (i % 20 === 0) setProgress({ current: i, total: table.rows.length, table: table.name })
          const g = (f: string) => { const sf = fm[f]; return sf ? row[sf] : null }
          const mapped = new Set(Object.values(fm))
          const extra = Object.entries(row).filter(([k, v]) => !mapped.has(k) && v && String(v).length > 1 && String(v).length < 300).map(([k, v]) => `${k}: ${v}`).slice(0, 10).join(' · ')
          try {
            if (entityType === 'companies') {
              const name = g('name') || ''; if (!name) { skipped++; continue }
              const record = await sanitizeForInsert(supabase, 'contacts', { workspace_id: ws.id, name, type: 'company', email: g('email'), phone: g('phone'), website: g('website'), notes: [g('notes'), extra].filter(Boolean).join(' · ') || null, tags: ['imported'], owner_id: user.id })
              const { error } = await supabase.from('contacts').insert(record)
              if (!error) imported++; else skipped++
            } else if (entityType === 'contacts') {
              const name = g('name') || ''; if (!name) { skipped++; continue }
              const record = await sanitizeForInsert(supabase, 'contacts', { workspace_id: ws.id, name, type: 'person', email: g('email'), phone: g('phone'), job_title: g('job_title'), company_name: g('company_name'), notes: [g('notes'), extra].filter(Boolean).join(' · ') || null, tags: ['imported'], owner_id: user.id })
              const { error } = await supabase.from('contacts').insert(record)
              if (!error) imported++; else skipped++
            } else if (entityType === 'products') {
              const name = g('name') || ''; if (!name) { skipped++; continue }
              const record = await sanitizeForInsert(supabase, 'products', { workspace_id: ws.id, name, sku: g('sku'), description: [g('description'), extra].filter(Boolean).join(' · ') || null, unit_price: parseFloat(String(g('unit_price') || 0).replace(/[^0-9.-]/g, '')) || 0, cost_price: parseFloat(String(g('cost_price') || 0).replace(/[^0-9.-]/g, '')) || 0, stock_quantity: parseInt(String(g('stock_quantity') || 100)) || 100, brand: g('brand'), model: g('model'), min_stock: 5, status: 'active', tags: ['imported'] })
              const { error } = await supabase.from('products').insert(record)
              if (!error) imported++; else skipped++
            } else if (entityType === 'deals') {
              const title = g('title') || ''; if (!title) { skipped++; continue }
              const record = await sanitizeForInsert(supabase, 'deals', { workspace_id: ws.id, title, value: parseFloat(String(g('value') || 0).replace(/[^0-9.-]/g, '')) || null, status: 'open', order_index: 0, notes: [g('notes'), extra].filter(Boolean).join(' · ') || null, owner_id: user.id })
              const { error } = await supabase.from('deals').insert(record)
              if (!error) imported++; else skipped++
            }
          } catch { skipped++ }
        }
      }
      if (imported > 0 || skipped > 0) results[entityType] = { imported, skipped }
    }
    setResult(results); setStep('done'); setImporting(false)
    toast.success(`${Object.values(results).reduce((s: number, r: any) => s + r.imported, 0)} records imported!`)
  }

  const totalToImport = tables.filter(t => t.mappedTo !== 'skip').reduce((s, t) => s + t.rows.length, 0)
  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="page-header"><div><h1 className="page-title">Smart Import</h1><p className="text-sm text-surface-500 mt-0.5">AI-powered — import everything from one file</p></div></div>
      {step === 'upload' && (<div className="card p-8"><div className="text-center mb-6"><div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><Brain className="w-8 h-8 text-white" /></div><h2 className="text-lg font-bold text-surface-900">Upload your database</h2><p className="text-sm text-surface-500 mt-1">AI will analyze the structure and import contacts, companies, products, and deals — keeping all useful information.</p></div><label className="block border-2 border-dashed border-surface-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-300 transition-colors"><Upload className="w-8 h-8 text-surface-300 mx-auto mb-3" /><p className="text-sm font-semibold text-surface-700">Click to upload</p><p className="text-xs text-surface-400 mt-1">Lark .base, CSV, JSON</p><input type="file" accept=".csv,.tsv,.json,.base" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} /></label></div>)}
      {step === 'analyzing' && (<div className="card p-8 text-center"><Sparkles className="w-12 h-12 text-brand-500 mx-auto mb-4 animate-pulse" /><h2 className="text-lg font-bold text-surface-900 mb-2">AI analyzing your data...</h2><p className="text-sm text-surface-500">Detecting entities, mapping fields, understanding relationships</p></div>)}
      {step === 'review' && (<div className="space-y-4"><div className="card p-5"><div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-brand-500" /><h2 className="text-sm font-bold text-surface-900">AI Analysis — {fileName}</h2></div><div className="space-y-3">{tables.map((table, i) => { const Icon = ENTITY_ICONS[table.mappedTo]; return (<div key={i} className={cn('p-4 rounded-xl border-2 transition-all', table.mappedTo === 'skip' ? 'border-surface-100 opacity-50' : 'border-brand-200 bg-brand-50/30')}><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3">{Icon && <Icon className="w-5 h-5 text-brand-600" />}<div><p className="text-sm font-bold text-surface-900">{table.name}</p><p className="text-[10px] text-surface-500">{table.rows.length} records · {table.headers.length} fields</p></div></div><select className="input text-xs w-36" value={table.mappedTo} onChange={e => setTables(prev => prev.map((t, idx) => idx === i ? { ...t, mappedTo: e.target.value } : t))}><option value="companies">→ Companies</option><option value="contacts">→ Contacts</option><option value="products">→ Products</option><option value="deals">→ Deals</option><option value="skip">Skip</option></select></div>{table.notes && <p className="text-xs text-surface-600 bg-white dark:bg-surface-800 rounded-lg p-2 mb-2">{table.notes}</p>}{Object.keys(table.fieldMapping).length > 0 ? (<div className="flex flex-wrap gap-1">{Object.entries(table.fieldMapping).map(([to, from]) => (<span key={to} className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">{from} → {to}</span>))}</div>) : (<div className="flex flex-wrap gap-1">{table.headers.slice(0, 8).map(h => (<span key={h} className="text-[9px] px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">{h}</span>))}{table.headers.length > 8 && <span className="text-[9px] text-surface-400">+{table.headers.length - 8}</span>}</div>)}</div>) })}</div></div><div className="flex gap-2"><button onClick={() => { setStep('upload'); setTables([]) }} className="btn-secondary flex-1">Back</button><button onClick={doImport} disabled={totalToImport === 0} className="btn-primary flex-1"><Upload className="w-4 h-4" /> Import {totalToImport} records</button></div></div>)}
      {step === 'importing' && (<div className="card p-8 text-center"><Loader2 className="w-12 h-12 text-brand-500 mx-auto mb-4 animate-spin" /><h2 className="text-lg font-bold text-surface-900 mb-2">Importing...</h2><p className="text-sm text-surface-500">{progress.table}</p><div className="w-full h-2 bg-surface-100 rounded-full mt-4 overflow-hidden"><div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} /></div><p className="text-xs text-surface-400 mt-2">{progress.current} / {progress.total}</p></div>)}
      {step === 'done' && result && (<div className="card p-8 text-center"><CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" /><h2 className="text-xl font-bold text-surface-900 mb-4">Import Complete!</h2><div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">{Object.entries(result).map(([entity, data]: any) => (<div key={entity} className="p-3 bg-surface-50 rounded-xl"><p className="text-lg font-bold text-surface-900">{data.imported}</p><p className="text-[10px] text-surface-500 capitalize">{entity}</p>{data.skipped > 0 && <p className="text-[9px] text-surface-400">{data.skipped} skipped</p>}</div>))}</div><div className="flex gap-2 justify-center"><button onClick={() => { setStep('upload'); setTables([]); setResult(null) }} className="btn-secondary">Import More</button><a href="/dashboard" className="btn-primary">Dashboard</a></div></div>)}
    </div>
  )
}
