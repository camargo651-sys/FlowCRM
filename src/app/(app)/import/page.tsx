'use client'
import { toast } from 'sonner'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, FileText, Table2, CheckCircle2, AlertTriangle, ArrowRight, X, Database } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParsedData {
  rows: Record<string, any>[]
  headers: string[]
  fileName: string
  format: string
}

const TARGET_ENTITIES = [
  { key: 'contacts', label: 'Contacts', fields: ['name', 'email', 'phone', 'company_name', 'job_title', 'website', 'notes', 'type', 'tags'] },
  { key: 'products', label: 'Products', fields: ['name', 'sku', 'description', 'unit_price', 'cost_price', 'stock_quantity', 'min_stock', 'brand', 'model', 'barcode'] },
  { key: 'deals', label: 'Deals', fields: ['title', 'value', 'status', 'expected_close_date', 'notes'] },
  { key: 'companies', label: 'Companies (as contacts)', fields: ['name', 'email', 'phone', 'website', 'notes'] },
]

export default function ImportPage() {
  const supabase = createClient()
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const [target, setTarget] = useState('contacts')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')

  const parseFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    let rows: Record<string, any>[] = []
    let headers: string[] = []

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text()
      const sep = ext === 'tsv' ? '\t' : ','
      const lines = text.split('\n').filter(l => l.trim())
      headers = lines[0].split(sep).map(h => h.trim().replace(/^"(.*)"$/, '$1'))
      rows = lines.slice(1).map(line => {
        const values: string[] = []
        let current = ''
        let inQuotes = false
        for (const char of line) {
          if (char === '"') { inQuotes = !inQuotes; continue }
          if (char === sep && !inQuotes) { values.push(current.trim()); current = ''; continue }
          current += char
        }
        values.push(current.trim())
        const row: Record<string, any> = {}
        headers.forEach((h, i) => { if (values[i]) row[h] = values[i] })
        return row
      }).filter(r => Object.values(r).some(v => v))
    } else if (ext === 'json' || ext === 'base') {
      const text = await file.text()
      let data = JSON.parse(text)

      // Handle .base format (Lark/Feishu Bitable)
      if (data.gzipSnapshot) {
        try {
          const binary = atob(data.gzipSnapshot)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const ds = new DecompressionStream('gzip')
          const writer = ds.writable.getWriter()
          writer.write(bytes)
          writer.close()
          const reader = ds.readable.getReader()
          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
          let offset = 0
          for (const chunk of chunks) { total.set(chunk, offset); offset += chunk.length }
          const snapData = JSON.parse(new TextDecoder().decode(total))

          // Extract records from last snapshot
          const lastItem = Array.isArray(snapData) ? snapData[snapData.length - 1] : snapData
          const schemaData = lastItem?.schema?.data || {}
          const fieldMap = schemaData.table?.fieldMap || {}
          const recordMap = schemaData.recordMap || {}

          const fidToName: Record<string, string> = {}
          for (const [fid, f] of Object.entries(fieldMap)) {
            fidToName[fid] = (f as any).name || fid
          }

          headers = Object.values(fidToName)

          for (const [, rec] of Object.entries(recordMap)) {
            const row: Record<string, any> = {}
            for (const [fid, cell] of Object.entries(rec as any)) {
              if (!cell || typeof cell !== 'object') continue
              const fname = fidToName[fid] || fid
              const val = (cell as any).value
              if (val === undefined || val === null) continue
              if (Array.isArray(val)) {
                row[fname] = val.map((v: any) => typeof v === 'object' ? (v.text || v.name || '') : String(v)).filter(Boolean).join('; ')
              } else {
                row[fname] = val
              }
            }
            if (Object.keys(row).length > 0) rows.push(row)
          }
        } catch (e) {
          toast.error('Failed to parse .base file')
          return
        }
      } else if (Array.isArray(data)) {
        rows = data
        if (data[0]) headers = Object.keys(data[0])
      } else if (data.data && Array.isArray(data.data)) {
        rows = data.data
        if (data.data[0]) headers = Object.keys(data.data[0])
      }
    }

    if (!rows.length) { toast.error('No data found in file'); return }

    setParsed({ rows, headers, fileName: file.name, format: ext || 'unknown' })

    // Auto-map common field names
    const entity = TARGET_ENTITIES.find(e => e.key === target)
    if (entity) {
      const autoMap: Record<string, string> = {}
      for (const field of entity.fields) {
        const match = headers.find(h => {
          const hl = h.toLowerCase().replace(/[_\s-]/g, '')
          const fl = field.replace(/_/g, '')
          return hl === fl || hl.includes(fl) || fl.includes(hl)
            || (fl === 'name' && (hl.includes('name') || hl.includes('nombre')))
            || (fl === 'email' && (hl.includes('email') || hl.includes('correo')))
            || (fl === 'phone' && (hl.includes('phone') || hl.includes('tel')))
            || (fl === 'companyname' && (hl.includes('company') || hl.includes('empresa')))
            || (fl === 'jobtitle' && (hl.includes('title') || hl.includes('role') || hl.includes('cargo')))
            || (fl === 'unitprice' && (hl.includes('price') || hl.includes('precio')))
        })
        if (match) autoMap[field] = match
      }
      setMapping(autoMap)
    }

    setStep('map')
    toast.success(`${rows.length} records found`)
  }

  const doImport = async () => {
    if (!parsed) return
    setImporting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not logged in'); setImporting(false); return }
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { toast.error('No workspace'); setImporting(false); return }

    const entity = TARGET_ENTITIES.find(e => e.key === target)
    if (!entity) return

    let imported = 0
    let skipped = 0
    const table = target === 'companies' ? 'contacts' : target === 'deals' ? 'deals' : target

    for (const row of parsed.rows) {
      const record: any = { workspace_id: ws.id, owner_id: user.id }

      for (const [field, header] of Object.entries(mapping)) {
        if (header && row[header] !== undefined) {
          let val = row[header]
          if (field === 'unit_price' || field === 'cost_price' || field === 'value' || field === 'stock_quantity' || field === 'min_stock') {
            val = parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0
          }
          record[field] = val || null
        }
      }

      // Skip if no name/title
      const nameField = target === 'deals' ? 'title' : 'name'
      if (!record[nameField]) { skipped++; continue }

      if (target === 'companies') record.type = 'company'
      if (target === 'contacts' && !record.type) record.type = 'person'
      if (target === 'products') { record.status = 'active'; record.stock_quantity = record.stock_quantity || 0 }
      if (target === 'deals') record.status = record.status || 'open'

      record.tags = ['imported']

      const { error } = await supabase.from(table).insert(record)
      if (!error) imported++
      else skipped++
    }

    setResult({ imported, skipped, total: parsed.rows.length })
    setStep('done')
    setImporting(false)
    toast.success(`${imported} records imported`)
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="page-header">
        <div><h1 className="page-title">Import Data</h1><p className="text-sm text-surface-500 mt-0.5">Import from any source</p></div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['Upload', 'Map Fields', 'Import'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
              i === ['upload', 'map', 'done'].indexOf(step) ? 'bg-brand-600 text-white' :
              i < ['upload', 'map', 'done'].indexOf(step) ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500')}>
              {i < ['upload', 'map', 'done'].indexOf(step) ? '✓' : i + 1}
            </div>
            <span className="text-xs font-medium text-surface-600">{s}</span>
            {i < 2 && <div className="w-12 h-0.5 bg-surface-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div className="text-center mb-6">
            <Database className="w-12 h-12 text-brand-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-surface-900">Upload your data</h2>
            <p className="text-sm text-surface-500 mt-1">Supports CSV, JSON, and Lark/Feishu .base files</p>
          </div>

          <div className="mb-6">
            <label className="label">What are you importing?</label>
            <div className="grid grid-cols-2 gap-2">
              {TARGET_ENTITIES.map(e => (
                <button key={e.key} onClick={() => setTarget(e.key)}
                  className={cn('p-3 rounded-xl text-left border-2 transition-all',
                    target === e.key ? 'border-brand-500 bg-brand-50' : 'border-surface-100 hover:border-surface-200')}>
                  <p className="text-sm font-semibold text-surface-800">{e.label}</p>
                  <p className="text-[10px] text-surface-400">{e.fields.slice(0, 4).join(', ')}...</p>
                </button>
              ))}
            </div>
          </div>

          <label className="block border-2 border-dashed border-surface-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-300 transition-colors">
            <Upload className="w-8 h-8 text-surface-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-surface-700">Click to upload or drag and drop</p>
            <p className="text-xs text-surface-400 mt-1">CSV, TSV, JSON, or .base files</p>
            <input type="file" accept=".csv,.tsv,.json,.base,.xlsx" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
          </label>
        </div>
      )}

      {/* Step 2: Map fields */}
      {step === 'map' && parsed && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Map your columns</h2>
              <p className="text-xs text-surface-500">{parsed.rows.length} records from {parsed.fileName} ({parsed.format})</p>
            </div>
            <button onClick={() => { setStep('upload'); setParsed(null) }} className="btn-ghost btn-sm"><X className="w-3.5 h-3.5" /> Start over</button>
          </div>

          <div className="space-y-2 mb-6">
            {TARGET_ENTITIES.find(e => e.key === target)?.fields.map(field => (
              <div key={field} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-surface-700 w-32 capitalize">{field.replace(/_/g, ' ')}</span>
                <ArrowRight className="w-3 h-3 text-surface-300" />
                <select className="input text-xs flex-1" value={mapping[field] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}>
                  <option value="">— Skip —</option>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {mapping[field] && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-surface-400 uppercase mb-2">Preview (first 3 rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-surface-200">
                  {Object.entries(mapping).filter(([, h]) => h).map(([field]) => (
                    <th key={field} className="text-left py-1 px-2 text-surface-400 capitalize">{field.replace(/_/g, ' ')}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {parsed.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-b border-surface-50">
                      {Object.entries(mapping).filter(([, h]) => h).map(([field, header]) => (
                        <td key={field} className="py-1 px-2 text-surface-600 truncate max-w-[150px]">{String(row[header] || '—').slice(0, 50)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setStep('upload'); setParsed(null) }} className="btn-secondary flex-1">Back</button>
            <button onClick={doImport} disabled={importing || !Object.values(mapping).some(v => v)}
              className="btn-primary flex-1">
              {importing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {parsed.rows.length} records
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 'done' && result && (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-surface-900 mb-2">Import Complete!</h2>
          <div className="flex justify-center gap-8 mb-6">
            <div><p className="text-2xl font-bold text-emerald-600">{result.imported}</p><p className="text-xs text-surface-500">Imported</p></div>
            <div><p className="text-2xl font-bold text-surface-400">{result.skipped}</p><p className="text-xs text-surface-500">Skipped</p></div>
            <div><p className="text-2xl font-bold text-surface-900">{result.total}</p><p className="text-xs text-surface-500">Total</p></div>
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setStep('upload'); setParsed(null); setResult(null); setMapping({}) }} className="btn-secondary">Import More</button>
            <a href={`/${target === 'companies' ? 'contacts' : target}`} className="btn-primary">View {target}</a>
          </div>
        </div>
      )}
    </div>
  )
}
