'use client'
import { toast } from 'sonner'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, Database, Loader2, Package, Users, ShoppingCart, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetectedTable {
  name: string
  rows: Record<string, any>[]
  headers: string[]
  mappedTo: string // contacts, products, deals, skip
  icon: string
}

const ENTITY_ICONS: Record<string, any> = {
  contacts: Users, products: Package, deals: TrendingUp, companies: Users, skip: null
}

export default function ImportPage() {
  const supabase = createClient()
  const [tables, setTables] = useState<DetectedTable[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'done'>('upload')
  const [progress, setProgress] = useState({ current: 0, total: 0, table: '' })

  const parseFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)
    const detected: DetectedTable[] = []

    if (ext === 'base') {
      // Lark/Feishu Bitable
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const binary = atob(data.gzipSnapshot)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const ds = new DecompressionStream('gzip')
        const writer = ds.writable.getWriter()
        writer.write(bytes); writer.close()
        const reader = ds.readable.getReader()
        const chunks: Uint8Array[] = []
        while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value) }
        const total = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
        let offset = 0
        for (const chunk of chunks) { total.set(chunk, offset); offset += chunk.length }
        const snapData = JSON.parse(new TextDecoder().decode(total))
        const items = Array.isArray(snapData) ? snapData : [snapData]

        for (const item of items) {
          const schema = item?.schema
          if (!schema?.data) continue
          const fieldMap = schema.data.table?.fieldMap || {}
          const recordMap = schema.data.recordMap || {}
          const fidToName: Record<string, string> = {}
          for (const [fid, f] of Object.entries(fieldMap)) { fidToName[fid] = (f as any).name || fid }
          const headers = Object.values(fidToName)

          const rows: Record<string, any>[] = []
          for (const [, rec] of Object.entries(recordMap)) {
            const row: Record<string, any> = {}
            for (const [fid, cell] of Object.entries(rec as any)) {
              if (!cell || typeof cell !== 'object') continue
              const fname = fidToName[fid] || fid
              const val = (cell as any).value
              if (val === undefined || val === null) continue
              if (Array.isArray(val)) {
                row[fname] = val.map((v: any) => typeof v === 'object' ? (v.text || v.name || '') : String(v)).filter(Boolean).join('; ')
              } else { row[fname] = val }
            }
            if (Object.keys(row).length > 0) rows.push(row)
          }

          if (rows.length === 0) continue

          // Auto-detect entity type
          const allFields = headers.join(' ').toLowerCase()
          let mappedTo = 'skip'
          let tableName = `Table (${rows.length} rows)`

          if (allFields.includes('company name') || allFields.includes('industry') || allFields.includes('client type')) {
            mappedTo = 'companies'; tableName = 'Companies'
          } else if (allFields.includes('full name') || allFields.includes('email') || allFields.includes('phone') || allFields.includes('contact')) {
            mappedTo = 'contacts'; tableName = 'Contacts'
          } else if (allFields.includes('product') || allFields.includes('price') || allFields.includes('capacity') || allFields.includes('weight')) {
            mappedTo = 'products'; tableName = 'Products'
          } else if (allFields.includes('project') || allFields.includes('budget') || allFields.includes('status') || allFields.includes('mwh') || allFields.includes('order')) {
            mappedTo = 'deals'; tableName = 'Deals / Projects'
          } else if (allFields.includes('username') || allFields.includes('role') || allFields.includes('permission')) {
            mappedTo = 'skip'; tableName = 'Users (skipped)'
          } else if (allFields.includes('config') || allFields.includes('key') || allFields.includes('value')) {
            mappedTo = 'skip'; tableName = 'Config (skipped)'
          }

          // Don't add duplicates
          if (!detected.find(d => d.name === tableName)) {
            detected.push({ name: tableName, rows, headers, mappedTo, icon: mappedTo })
          }
        }
      } catch (e) { toast.error('Failed to parse .base file'); return }
    } else if (ext === 'csv') {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"(.*)"$/, '$1'))
      const rows = lines.slice(1).map(line => {
        const values: string[] = []; let current = ''; let inQ = false
        for (const c of line) { if (c === '"') { inQ = !inQ; continue }; if (c === ',' && !inQ) { values.push(current.trim()); current = ''; continue }; current += c }
        values.push(current.trim())
        const row: Record<string, any> = {}
        headers.forEach((h, i) => { if (values[i]) row[h] = values[i] })
        return row
      }).filter(r => Object.values(r).some(v => v))

      detected.push({ name: file.name, rows, headers, mappedTo: 'contacts', icon: 'contacts' })
    } else if (ext === 'json') {
      const data = JSON.parse(await file.text())
      const rows = Array.isArray(data) ? data : data.data || [data]
      const headers = rows[0] ? Object.keys(rows[0]) : []
      detected.push({ name: file.name, rows, headers, mappedTo: 'contacts', icon: 'contacts' })
    }

    if (detected.length === 0) { toast.error('No importable data found'); return }

    setTables(detected)
    setStep('review')
    toast.success(`Found ${detected.length} tables with ${detected.reduce((s, t) => s + t.rows.length, 0)} total records`)
  }

  const updateMapping = (idx: number, mappedTo: string) => {
    setTables(prev => prev.map((t, i) => i === idx ? { ...t, mappedTo } : t))
  }

  const doImport = async () => {
    setStep('importing')
    setImporting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not logged in'); return }
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { toast.error('No workspace'); return }

    const results: any = {}
    const companyIdMap = new Map<string, string>() // name -> supabase id

    // Import in order: companies first, then contacts (to link), then products, then deals
    const order = ['companies', 'contacts', 'products', 'deals']

    for (const entityType of order) {
      const tablesToImport = tables.filter(t => t.mappedTo === entityType)
      if (tablesToImport.length === 0) continue

      let imported = 0
      let skipped = 0

      for (const table of tablesToImport) {
        setProgress({ current: 0, total: table.rows.length, table: table.name })

        for (let i = 0; i < table.rows.length; i++) {
          const row = table.rows[i]
          if (i % 20 === 0) setProgress({ current: i, total: table.rows.length, table: table.name })

          try {
            if (entityType === 'companies') {
              const name = row['Company Name'] || row['Name'] || row['name'] || row['Company'] || ''
              if (!name) { skipped++; continue }
              const { data, error } = await supabase.from('contacts').insert({
                workspace_id: ws.id, name, type: 'company',
                email: row['Email'] || row['email'] || null,
                phone: row['Phone'] || row['phone'] || null,
                website: row['Client Website (if any)'] || row['Website'] || row['website'] || null,
                notes: [row['Brief Introduction of Client'], row['Country'], row['City'], row['Industry']].filter(Boolean).join(' · ') || null,
                tags: ['imported'], owner_id: user.id,
              }).select('id').single()
              if (!error && data) { imported++; companyIdMap.set(name.toLowerCase(), data.id) }
              else skipped++
            } else if (entityType === 'contacts') {
              const name = row['Full Name'] || row['Name'] || row['name'] || row['Contact Name'] || ''
              if (!name) { skipped++; continue }
              const companyName = row['Company Name'] || row['Company'] || ''
              const { error } = await supabase.from('contacts').insert({
                workspace_id: ws.id, name, type: 'person',
                email: row['Email'] || row['email'] || null,
                phone: row['Phone'] || row['phone'] || null,
                job_title: row['Role / Title'] || row['Title'] || row['Role'] || null,
                company_name: companyName || null,
                tags: ['imported'], owner_id: user.id,
              })
              if (!error) imported++; else skipped++
            } else if (entityType === 'products') {
              const name = row['Name'] || row['Product Name'] || row['name'] || ''
              if (!name) { skipped++; continue }
              const { error } = await supabase.from('products').insert({
                workspace_id: ws.id, name,
                sku: row['SKU'] || row['Code'] || null,
                unit_price: parseFloat(String(row['List Price'] || row['Price'] || row['price'] || 0).replace(/[^0-9.-]/g, '')) || 0,
                cost_price: parseFloat(String(row['Cost'] || row['cost_price'] || 0).replace(/[^0-9.-]/g, '')) || 0,
                stock_quantity: parseInt(String(row['Stock'] || row['Quantity'] || 100)) || 100,
                min_stock: 5, status: 'active', tags: ['imported'],
              })
              if (!error) imported++; else skipped++
            } else if (entityType === 'deals') {
              const title = row['Project Name'] || row['Name'] || row['Title'] || row['name'] || ''
              if (!title) { skipped++; continue }
              const { error } = await supabase.from('deals').insert({
                workspace_id: ws.id, title,
                value: parseFloat(String(row['Budget'] || row['Value'] || row['value'] || 0).replace(/[^0-9.-]/g, '')) || null,
                status: 'open', order_index: 0,
                notes: [row['Notes'], row['Description'], row['City/location']].filter(Boolean).join(' · ') || null,
                tags: ['imported'], owner_id: user.id,
              })
              if (!error) imported++; else skipped++
            }
          } catch { skipped++ }
        }
      }
      results[entityType] = { imported, skipped }
    }

    setResult(results)
    setStep('done')
    setImporting(false)
  }

  const totalToImport = tables.filter(t => t.mappedTo !== 'skip').reduce((s, t) => s + t.rows.length, 0)

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="page-header">
        <div><h1 className="page-title">Import Data</h1><p className="text-sm text-surface-500 mt-0.5">Import everything from one file</p></div>
      </div>

      {/* Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div className="text-center mb-6">
            <Database className="w-12 h-12 text-brand-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-surface-900">Upload your database</h2>
            <p className="text-sm text-surface-500 mt-1">We'll detect all tables and import everything at once</p>
          </div>
          <label className="block border-2 border-dashed border-surface-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-300 transition-colors">
            <Upload className="w-8 h-8 text-surface-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-surface-700">Click to upload or drag and drop</p>
            <p className="text-xs text-surface-400 mt-1">Supports: Lark .base, CSV, JSON</p>
            <input type="file" accept=".csv,.tsv,.json,.base" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
          </label>
        </div>
      )}

      {/* Review detected tables */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-bold text-surface-900 mb-1">Detected from {fileName}</h2>
            <p className="text-xs text-surface-500 mb-4">{tables.length} tables, {tables.reduce((s, t) => s + t.rows.length, 0)} total records</p>

            <div className="space-y-3">
              {tables.map((table, i) => {
                const Icon = ENTITY_ICONS[table.mappedTo]
                return (
                  <div key={i} className={cn('p-4 rounded-xl border-2 transition-all', table.mappedTo === 'skip' ? 'border-surface-100 opacity-50' : 'border-brand-200 bg-brand-50/30')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {Icon && <Icon className="w-5 h-5 text-brand-600" />}
                        <div>
                          <p className="text-sm font-bold text-surface-900">{table.name}</p>
                          <p className="text-[10px] text-surface-500">{table.rows.length} records · {table.headers.length} fields</p>
                        </div>
                      </div>
                      <select className="input text-xs w-36" value={table.mappedTo} onChange={e => updateMapping(i, e.target.value)}>
                        <option value="companies">→ Companies</option>
                        <option value="contacts">→ Contacts</option>
                        <option value="products">→ Products</option>
                        <option value="deals">→ Deals</option>
                        <option value="skip">Skip</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {table.headers.slice(0, 8).map(h => (
                        <span key={h} className="text-[9px] px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 rounded text-surface-500">{h}</span>
                      ))}
                      {table.headers.length > 8 && <span className="text-[9px] text-surface-400">+{table.headers.length - 8} more</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setStep('upload'); setTables([]) }} className="btn-secondary flex-1">Back</button>
            <button onClick={doImport} disabled={totalToImport === 0} className="btn-primary flex-1">
              <Upload className="w-4 h-4" /> Import {totalToImport} records
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="card p-8 text-center">
          <Loader2 className="w-12 h-12 text-brand-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-lg font-bold text-surface-900 mb-2">Importing...</h2>
          <p className="text-sm text-surface-500">{progress.table}</p>
          <div className="w-full h-2 bg-surface-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-surface-400 mt-2">{progress.current} / {progress.total}</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-surface-900 mb-4">Import Complete!</h2>
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-6">
            {Object.entries(result).map(([entity, data]: any) => (
              <div key={entity} className="p-3 bg-surface-50 rounded-xl">
                <p className="text-lg font-bold text-surface-900">{data.imported}</p>
                <p className="text-[10px] text-surface-500 capitalize">{entity} imported</p>
                {data.skipped > 0 && <p className="text-[9px] text-surface-400">{data.skipped} skipped</p>}
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setStep('upload'); setTables([]); setResult(null) }} className="btn-secondary">Import More</button>
            <a href="/contacts" className="btn-primary">View Contacts</a>
          </div>
        </div>
      )}
    </div>
  )
}
