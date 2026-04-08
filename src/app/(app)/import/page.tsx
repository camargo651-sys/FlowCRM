'use client'
import { DbRow } from '@/types'
import { toast } from 'sonner'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, Loader2, Package, Users, TrendingUp, Sparkles, Brain, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================
interface DetectedTable {
  name: string
  rows: DbRow[]
  headers: string[]
  mappedTo: 'companies' | 'contacts' | 'products' | 'deals' | 'skip'
  fieldMapping: Record<string, string>
  notes: string
}

type DupStrategy = 'skip' | 'update' | 'create'
type Step = 'upload' | 'analyzing' | 'review' | 'importing' | 'done'

const ENTITY_CONFIG = {
  companies: { icon: Users, table: 'contacts', nameField: 'name', color: 'text-violet-600' },
  contacts: { icon: Users, table: 'contacts', nameField: 'name', color: 'text-blue-600' },
  products: { icon: Package, table: 'products', nameField: 'name', color: 'text-amber-600' },
  deals: { icon: TrendingUp, table: 'deals', nameField: 'title', color: 'text-emerald-600' },
}

// ============================================================
// File Parsers
// ============================================================
function parseCSV(text: string): { headers: string[]; rows: DbRow[] } {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue }
      if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue }
      cur += c
    }
    vals.push(cur.trim())
    const row: DbRow = {}
    headers.forEach((h, i) => { if (vals[i]) row[h] = vals[i] })
    return row
  }).filter(r => Object.values(r).some(v => v))
  return { headers, rows }
}

async function parseLarkBase(text: string): Promise<DetectedTable[]> {
  const data = JSON.parse(text)
  if (!data.gzipSnapshot) throw new Error('Not a valid .base file')

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

  const totalBytes = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0))
  let offset = 0
  for (const chunk of chunks) { totalBytes.set(chunk, offset); offset += chunk.length }

  const snapData = JSON.parse(new TextDecoder().decode(totalBytes))
  const items = Array.isArray(snapData) ? snapData : [snapData]
  const tables: DetectedTable[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const schemaData = item?.schema?.data
    if (!schemaData) continue

    const fieldMap = schemaData.table?.fieldMap || {}
    const recordMap = schemaData.recordMap || {}
    const fieldNames: Record<string, string> = {}
    for (const [fid, f] of Object.entries(fieldMap)) {
      fieldNames[fid] = (f as { name?: string }).name || fid
    }

    const headers = Object.values(fieldNames)
    const rows: DbRow[] = []

    for (const rec of Object.values(recordMap)) {
      const row: DbRow = {}
      for (const [fid, cell] of Object.entries(rec as DbRow)) {
        if (!cell || typeof cell !== 'object') continue
        const name = fieldNames[fid] || fid
        const val = (cell as { value?: unknown }).value
        if (val == null) continue
        if (Array.isArray(val)) {
          row[name] = val.map((v: { value?: string; text?: string; name?: string }) =>
            typeof v === 'object' ? (v.text || v.name || '') : String(v)
          ).filter(Boolean).join('; ')
        } else {
          row[name] = val
        }
      }
      if (Object.keys(row).length > 0) rows.push(row)
    }

    if (rows.length === 0) continue
    const sig = headers.sort().join('|')
    if (seen.has(sig)) continue
    seen.add(sig)

    tables.push({
      name: `Table (${rows.length} rows)`,
      rows, headers,
      mappedTo: 'skip',
      fieldMapping: {},
      notes: '',
    })
  }

  return tables
}

// ============================================================
// Component
// ============================================================
export default function ImportPage() {
  const supabase = createClient()
  const [tables, setTables] = useState<DetectedTable[]>([])
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState<Step>('upload')
  const [dupStrategy, setDupStrategy] = useState<DupStrategy>('skip')
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [result, setResult] = useState<Record<string, { imported: number; skipped: number; updated: number }>>({})

  // ---- PARSE FILE ----
  const handleFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    setFileName(file.name)

    let detected: DetectedTable[] = []
    try {
      if (ext === 'base') {
        detected = await parseLarkBase(await file.text())
      } else if (ext === 'csv' || ext === 'tsv') {
        const { headers, rows } = parseCSV(await file.text())
        if (rows.length) detected = [{ name: file.name, rows, headers, mappedTo: 'contacts', fieldMapping: {}, notes: '' }]
      } else if (ext === 'json') {
        const d = JSON.parse(await file.text())
        const rows = Array.isArray(d) ? d : d.data || [d]
        const headers = rows[0] ? Object.keys(rows[0]) : []
        if (rows.length) detected = [{ name: file.name, rows, headers, mappedTo: 'contacts', fieldMapping: {}, notes: '' }]
      } else {
        toast.error('Unsupported file format')
        return
      }
    } catch (e: unknown) {
      toast.error(`Parse error: ${e instanceof Error ? e.message : 'Unknown error'}`)
      return
    }

    if (!detected.length) { toast.error('No data found'); return }
    setTables(detected)
    setStep('analyzing')

    // Ask AI to analyze
    try {
      const res = await fetch('/api/ai/analyze-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: detected.map(t => ({
            name: t.name,
            headers: t.headers,
            rows: t.rows.slice(0, 3),
          })),
        }),
      })

      if (res.ok) {
        const { analysis } = await res.json()
        if (Array.isArray(analysis)) {
          setTables(detected.map((t, i) => {
            const ai = analysis[i]
            if (!ai) return t
            return {
              ...t,
              name: ai.tableName || t.name,
              mappedTo: ai.mappedTo || 'skip',
              fieldMapping: ai.fieldMapping || {},
              notes: ai.notes || '',
            }
          }))
          toast.success('AI analysis complete')
        }
      } else {
        // Fallback: rule-based detection
        setTables(detected.map(t => {
          const f = t.headers.join(' ').toLowerCase()
          let m: DetectedTable['mappedTo'] = 'skip'
          if (f.includes('company name') || f.includes('industry') || f.includes('client type')) m = 'companies'
          else if (f.includes('full name') || (f.includes('email') && f.includes('phone'))) m = 'contacts'
          else if (f.includes('price') || f.includes('capacity') || f.includes('weight') || f.includes('product')) m = 'products'
          else if (f.includes('project') || f.includes('budget') || f.includes('status') || f.includes('order') || f.includes('mwh')) m = 'deals'
          return { ...t, mappedTo: m }
        }))
        toast.info('Using rule-based detection')
      }
    } catch {
      toast.info('AI unavailable — using defaults')
    }

    setStep('review')
  }

  // ---- IMPORT ----
  const doImport = async () => {
    setStep('importing')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not logged in'); setStep('review'); return }
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) { toast.error('No workspace'); setStep('review'); return }

    const results: typeof result = {}

    // Discover existing columns once per table
    const columnCache: Record<string, Set<string>> = {}
    const getColumns = async (table: string) => {
      if (columnCache[table]) return columnCache[table]
      const { data } = await supabase.from(table).select('*').limit(1)
      const cols = new Set(data?.[0] ? Object.keys(data[0]) : [])
      columnCache[table] = cols
      return cols
    }

    const cleanRecord = async (table: string, data: DbRow) => {
      const cols = await getColumns(table)

      // Extract overflow before processing
      const overflowText = data._overflow || ''
      delete data._overflow

      // If we can't discover columns (empty table), only use the safest fields
      if (cols.size === 0) {
        // Remove potentially problematic fields
        const safe = { ...data }
        delete safe.notes  // might not exist
        delete safe.tags   // might not exist
        return safe
      }

      const clean: DbRow = {}
      const overflow: string[] = []

      // Only include fields that exist in the table
      for (const [k, v] of Object.entries(data)) {
        if (cols.has(k)) { clean[k] = v }
        else if (v && String(v).length > 1 && !['workspace_id', 'owner_id'].includes(k)) {
          overflow.push(`${k}: ${String(v).slice(0, 150)}`)
        }
      }

      // Add the overflow text
      if (overflowText) overflow.unshift(overflowText)

      // Store overflow in the best available field
      if (overflow.length > 0) {
        const overflowStr = overflow.join(' · ')
        if (cols.has('custom_fields')) {
          const cf = typeof clean.custom_fields === 'object' && clean.custom_fields ? { ...clean.custom_fields } : {}
          cf._imported_data = overflowStr
          clean.custom_fields = cf
        } else if (cols.has('notes')) {
          clean.notes = [clean.notes, overflowStr].filter(Boolean).join(' · ')
        } else if (cols.has('metadata')) {
          const md = typeof clean.metadata === 'object' && clean.metadata ? { ...clean.metadata } : {}
          md._imported_data = overflowStr
          clean.metadata = md
        }
        // If none of these exist, data is lost but insert won't fail
      }

      return clean
    }

    const checkDup = async (table: string, record: DbRow): Promise<string | null> => {
      if (dupStrategy === 'create') return null
      const nameKey = table === 'deals' ? 'title' : 'name'
      const name = record[nameKey]
      if (!name) return null

      // Check by email first (contacts)
      if (table === 'contacts' && record.email) {
        const { data } = await supabase.from(table).select('id').eq('workspace_id', ws.id).ilike('email', record.email).single()
        if (data) return data.id
      }
      // Check by name/title
      const { data } = await supabase.from(table).select('id').eq('workspace_id', ws.id).ilike(nameKey, name).single()
      return data?.id || null
    }

    for (const entityType of ['companies', 'contacts', 'products', 'deals'] as const) {
      const toImport = tables.filter(t => t.mappedTo === entityType)
      if (!toImport.length) continue

      const config = ENTITY_CONFIG[entityType]
      let imported = 0, skipped = 0, updated = 0

      for (const table of toImport) {
        const fm = table.fieldMapping
        setProgress({ current: 0, total: table.rows.length, label: `${entityType}: ${table.name}` })

        for (let i = 0; i < table.rows.length; i++) {
          if (i % 10 === 0) setProgress({ current: i, total: table.rows.length, label: `${entityType}: ${table.name}` })

          const row = table.rows[i]
          const get = (field: string) => fm[field] ? row[fm[field]] : null

          // Build base record
          let baseRecord: DbRow = { workspace_id: ws.id, owner_id: user.id }

          // Build only fields that we KNOW exist in the base schema
          // All extra/unmapped data goes through cleanRecord which handles overflow
          if (entityType === 'companies') {
            const name = get('name'); if (!name) { skipped++; continue }
            baseRecord = { ...baseRecord, name, type: 'company', email: get('email'), phone: get('phone'), website: get('website') }
          } else if (entityType === 'contacts') {
            const name = get('name'); if (!name) { skipped++; continue }
            baseRecord = { ...baseRecord, name, type: 'person', email: get('email'), phone: get('phone'), job_title: get('job_title'), company_name: get('company_name') }
          } else if (entityType === 'products') {
            const name = get('name'); if (!name) { skipped++; continue }
            baseRecord = { ...baseRecord, name, sku: get('sku'), description: get('description'), unit_price: parseFloat(String(get('unit_price') || 0).replace(/[^0-9.-]/g, '')) || 0, cost_price: parseFloat(String(get('cost_price') || 0).replace(/[^0-9.-]/g, '')) || 0, stock_quantity: parseInt(String(get('stock_quantity') || 100)) || 100, min_stock: 5, status: 'active' }
          } else if (entityType === 'deals') {
            const title = get('title'); if (!title) { skipped++; continue }
            baseRecord = { ...baseRecord, title, value: parseFloat(String(get('value') || 0).replace(/[^0-9.-]/g, '')) || null, status: 'open', order_index: 0 }
          }

          // Collect ALL unmapped fields + mapped notes as overflow
          const mappedSources = new Set(Object.values(fm))
          const allExtras: string[] = []
          const mappedNotes = get('notes')
          if (mappedNotes) allExtras.push(String(mappedNotes))
          Object.entries(row)
            .filter(([k, v]) => !mappedSources.has(k) && v && String(v).length > 1 && String(v).length < 300)
            .slice(0, 15)
            .forEach(([k, v]) => allExtras.push(`${k}: ${v}`))

          // Add overflow as a special key that cleanRecord will handle
          if (allExtras.length > 0) {
            baseRecord._overflow = allExtras.join(' · ')
          }

          // Clean record — removes unknown columns, distributes overflow
          const record = await cleanRecord(config.table, baseRecord)

          // Check duplicates
          try {
            const existingId = await checkDup(config.table, record)
            if (existingId) {
              if (dupStrategy === 'skip') { skipped++; continue }
              if (dupStrategy === 'update') {
                const { workspace_id: _, owner_id: __, ...updateData } = record
                await supabase.from(config.table).update(updateData).eq('id', existingId)
                updated++
                continue
              }
            }
            const { error } = await supabase.from(config.table).insert(record)
            if (!error) imported++
            else { console.error(`Insert error (${entityType}):`, error.message); skipped++ }
          } catch { skipped++ }
        }
      }

      if (imported > 0 || skipped > 0 || updated > 0) {
        results[entityType] = { imported, skipped, updated }
      }
    }

    setResult(results)
    setStep('done')
    const totalImported = Object.values(results).reduce((s, r) => s + r.imported + r.updated, 0)
    toast.success(`${totalImported} records imported!`)
  }

  // ---- RENDER ----
  const totalToImport = tables.filter(t => t.mappedTo !== 'skip').reduce((s, t) => s + t.rows.length, 0)

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Smart Import</h1>
          <p className="text-sm text-surface-500 mt-0.5">AI-powered — import everything from one file</p>
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-surface-900">Upload your database</h2>
            <p className="text-sm text-surface-500 mt-1">
              AI analyzes the structure, detects duplicates, and imports everything — contacts, companies, products, and deals.
            </p>
          </div>
          <label className="block border-2 border-dashed border-surface-200 rounded-2xl p-12 text-center cursor-pointer hover:border-brand-300 transition-colors">
            <Upload className="w-8 h-8 text-surface-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-surface-700">Click to upload</p>
            <p className="text-xs text-surface-400 mt-1">Lark .base, CSV, JSON</p>
            <input type="file" accept=".csv,.tsv,.json,.base" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
        </div>
      )}

      {/* STEP 2: AI Analyzing */}
      {step === 'analyzing' && (
        <div className="card p-8 text-center">
          <Sparkles className="w-12 h-12 text-brand-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-lg font-bold text-surface-900 mb-2">AI analyzing your data...</h2>
          <p className="text-sm text-surface-500">Detecting entities, mapping fields, understanding relationships</p>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          {/* Tables detected */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-brand-500" />
              <h2 className="text-sm font-bold text-surface-900">AI Analysis — {fileName}</h2>
            </div>
            <div className="space-y-3">
              {tables.map((table, i) => {
                const cfg = table.mappedTo !== 'skip' ? ENTITY_CONFIG[table.mappedTo] : null
                const Icon = cfg?.icon
                return (
                  <div key={i} className={cn('p-4 rounded-xl border-2 transition-all',
                    table.mappedTo === 'skip' ? 'border-surface-100 opacity-50' : 'border-brand-200 bg-brand-50/30')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {Icon && <Icon className={cn('w-5 h-5', cfg?.color)} />}
                        <div>
                          <p className="text-sm font-bold text-surface-900">{table.name}</p>
                          <p className="text-[10px] text-surface-500">{table.rows.length} records · {table.headers.length} fields</p>
                        </div>
                      </div>
                      <select className="input text-xs w-36" value={table.mappedTo}
                        onChange={e => setTables(prev => prev.map((t, idx) =>
                          idx === i ? { ...t, mappedTo: e.target.value as DetectedTable['mappedTo'] } : t))}>
                        <option value="companies">→ Companies</option>
                        <option value="contacts">→ Contacts</option>
                        <option value="products">→ Products</option>
                        <option value="deals">→ Deals</option>
                        <option value="skip">Skip</option>
                      </select>
                    </div>
                    {table.notes && (
                      <p className="text-xs text-surface-600 bg-white dark:bg-surface-800 rounded-lg p-2 mb-2">{table.notes}</p>
                    )}
                    {Object.keys(table.fieldMapping).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(table.fieldMapping).map(([to, from]) => (
                          <span key={to} className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">{from} → {to}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {table.headers.slice(0, 8).map(h => (
                          <span key={h} className="text-[9px] px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">{h}</span>
                        ))}
                        {table.headers.length > 8 && <span className="text-[9px] text-surface-400">+{table.headers.length - 8}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Duplicate strategy */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-surface-700 mb-2">When duplicates are found:</p>
            <div className="flex gap-2">
              {([
                { key: 'skip' as const, label: 'Skip', desc: 'Keep existing, ignore new' },
                { key: 'update' as const, label: 'Update', desc: 'Merge new data into existing' },
                { key: 'create' as const, label: 'Create anyway', desc: 'Allow duplicates' },
              ]).map(opt => (
                <button key={opt.key} onClick={() => setDupStrategy(opt.key)}
                  className={cn('flex-1 p-3 rounded-xl text-left border-2 transition-all',
                    dupStrategy === opt.key ? 'border-brand-500 bg-brand-50' : 'border-surface-100 hover:border-surface-200')}>
                  <p className="text-xs font-semibold text-surface-800">{opt.label}</p>
                  <p className="text-[9px] text-surface-400">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => { setStep('upload'); setTables([]) }} className="btn-secondary flex-1">Back</button>
            <button onClick={doImport} disabled={totalToImport === 0} className="btn-primary flex-1">
              <Upload className="w-4 h-4" /> Import {totalToImport} records
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Importing */}
      {step === 'importing' && (
        <div className="card p-8 text-center">
          <Loader2 className="w-12 h-12 text-brand-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-lg font-bold text-surface-900 mb-2">Importing...</h2>
          <p className="text-sm text-surface-500">{progress.label}</p>
          <div className="w-full h-2 bg-surface-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full transition-all"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-surface-400 mt-2">{progress.current} / {progress.total}</p>
        </div>
      )}

      {/* STEP 5: Done */}
      {step === 'done' && (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-surface-900 mb-4">Import Complete!</h2>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6">
            {Object.entries(result).map(([entity, data]) => (
              <div key={entity} className="p-3 bg-surface-50 rounded-xl text-left">
                <p className="text-xs font-bold text-surface-500 capitalize mb-1">{entity}</p>
                <div className="flex gap-3">
                  {data.imported > 0 && <div><p className="text-lg font-bold text-emerald-600">{data.imported}</p><p className="text-[9px] text-surface-400">new</p></div>}
                  {data.updated > 0 && <div><p className="text-lg font-bold text-blue-600">{data.updated}</p><p className="text-[9px] text-surface-400">updated</p></div>}
                  {data.skipped > 0 && <div><p className="text-lg font-bold text-surface-400">{data.skipped}</p><p className="text-[9px] text-surface-400">skipped</p></div>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setStep('upload'); setTables([]); setResult({}) }} className="btn-secondary">Import More</button>
            <a href="/dashboard" className="btn-primary">Dashboard</a>
          </div>
        </div>
      )}
    </div>
  )
}
