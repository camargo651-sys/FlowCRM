'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import {
  Users,
  AlertTriangle,
  Upload,
  Merge,
  CheckCircle2,
  X,
  FileText,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  analyzeWorkspace,
  type WorkspaceHealthReport,
  type QualityIssue,
} from '@/lib/data-quality/analyzer'
import {
  detectColumns,
  transformRow,
  type ColumnMapping,
  type FieldKey,
} from '@/lib/data-quality/csv-mapper'

// ─── Types ──────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  job_title: string | null
  tags: string[] | null
  type?: string | null
}

type Tab = 'duplicates' | 'quality' | 'import'

// ─── Utilities ──────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1]
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
    }
  }
  return matrix[b.length][a.length]
}

function findDuplicateGroups(contacts: Contact[]): Contact[][] {
  const groups: Contact[][] = []
  const visited = new Set<string>()

  for (const c of contacts) {
    if (visited.has(c.id)) continue
    const matches: Contact[] = [c]
    for (const other of contacts) {
      if (other.id === c.id || visited.has(other.id)) continue
      let match = false
      if (c.email && other.email && c.email.toLowerCase().trim() === other.email.toLowerCase().trim()) match = true
      if (!match && c.phone && other.phone) {
        const p1 = c.phone.replace(/\D/g, '')
        const p2 = other.phone.replace(/\D/g, '')
        if (p1 && p1 === p2) match = true
      }
      if (!match && c.name && other.name) {
        const n1 = c.name.toLowerCase().trim()
        const n2 = other.name.toLowerCase().trim()
        const sameCompany =
          (c.company_name || '').toLowerCase().trim() === (other.company_name || '').toLowerCase().trim()
        if (sameCompany && n1.length >= 3 && n2.length >= 3 && levenshtein(n1, n2) < 3) match = true
      }
      if (match) matches.push(other)
    }
    if (matches.length >= 2) {
      matches.forEach(m => visited.add(m.id))
      groups.push(matches)
    }
  }
  return groups
}

// ─── CSV parser ─────────────────────────────────────────────────

function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  for (const line of lines) {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current)
        current = ''
      } else current += ch
    }
    cells.push(current)
    rows.push(cells.map(c => c.trim()))
  }
  return rows
}

// ─── Page ───────────────────────────────────────────────────────

export default function DataQualityPage() {
  const [tab, setTab] = useState<Tab>('duplicates')

  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Quality</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Keep your workspace data clean, deduplicated and complete
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-800 mb-6">
        {(
          [
            { key: 'duplicates', label: 'Duplicates', icon: <Merge className="w-4 h-4" /> },
            { key: 'quality', label: 'Quality Issues', icon: <AlertTriangle className="w-4 h-4" /> },
            { key: 'import', label: 'Smart Import', icon: <Upload className="w-4 h-4" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]
        ).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-[1px]',
              tab === t.key
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'duplicates' && <DuplicatesTab />}
      {tab === 'quality' && <QualityTab />}
      {tab === 'import' && <ImportTab />}
    </div>
  )
}

// ─── Duplicates Tab ─────────────────────────────────────────────

function DuplicatesTab() {
  const supabase = createClient()
  const [groups, setGroups] = useState<Contact[][]>([])
  const [loading, setLoading] = useState(true)
  const [merging, setMerging] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setLoading(false)
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return setLoading(false)
    const { data } = await supabase
      .from('contacts')
      .select('id, name, email, phone, company_name, job_title, tags, type')
      .eq('workspace_id', ws.id)
    const contacts = (data || []) as Contact[]
    setGroups(findDuplicateGroups(contacts))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const merge = async (primary: Contact, duplicates: Contact[]) => {
    setMerging(primary.id)
    try {
      const res = await fetch('/api/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryId: primary.id,
          duplicateIds: duplicates.map(d => d.id),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error?.message || 'Merge failed')
      }
      toast.success(`Merged ${duplicates.length} contact(s) into ${primary.name}`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setMerging(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="card p-12 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-surface-900 dark:text-surface-50">No duplicates found</h3>
        <p className="text-sm text-surface-500 mt-1">
          Your contacts look clean. We checked for matching email, phone and fuzzy name + company.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-500">
        Found <b>{groups.length}</b> duplicate group{groups.length !== 1 ? 's' : ''}. Choose which record to keep; the
        others will be merged into it.
      </p>
      {groups.map((group, gi) => (
        <DuplicateGroupCard
          key={gi}
          group={group}
          onMerge={merge}
          merging={merging}
        />
      ))}
    </div>
  )
}

function DuplicateGroupCard({
  group,
  onMerge,
  merging,
}: {
  group: Contact[]
  onMerge: (primary: Contact, duplicates: Contact[]) => void
  merging: string | null
}) {
  const [primaryId, setPrimaryId] = useState<string>(group[0].id)
  const primary = group.find(c => c.id === primaryId) || group[0]
  const duplicates = group.filter(c => c.id !== primaryId)

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
          Group of {group.length}
        </h4>
        <button
          onClick={() => onMerge(primary, duplicates)}
          disabled={merging === primary.id}
          className="btn-primary btn-sm"
        >
          {merging === primary.id ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Merge className="w-4 h-4" />
          )}
          Merge into {primary.name || 'primary'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {group.map(c => (
          <label
            key={c.id}
            className={cn(
              'border-2 rounded-xl p-3 cursor-pointer transition-all',
              c.id === primaryId
                ? 'border-brand-500 bg-brand-50/30 dark:bg-brand-500/10'
                : 'border-surface-100 dark:border-surface-800 hover:border-surface-200',
            )}
          >
            <div className="flex items-start gap-2">
              <input
                type="radio"
                name={`primary-${group[0].id}`}
                checked={c.id === primaryId}
                onChange={() => setPrimaryId(c.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-50 truncate">
                  {c.name || 'Unnamed'}
                </p>
                {c.email && <p className="text-xs text-surface-500 truncate">{c.email}</p>}
                {c.phone && <p className="text-xs text-surface-500 truncate">{c.phone}</p>}
                {c.company_name && <p className="text-xs text-surface-500 truncate">{c.company_name}</p>}
                {c.id === primaryId && (
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 bg-brand-600 text-white rounded-full font-semibold">
                    PRIMARY
                  </span>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Quality Tab ────────────────────────────────────────────────

function QualityTab() {
  const supabase = createClient()
  const [report, setReport] = useState<WorkspaceHealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<QualityIssue | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setLoading(false)
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws) return setLoading(false)
    const r = await analyzeWorkspace(ws.id, supabase)
    setReport(r)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (!report) return null

  const scoreColor =
    report.healthScore >= 80
      ? 'text-emerald-600'
      : report.healthScore >= 60
        ? 'text-amber-600'
        : 'text-rose-600'

  return (
    <div className="space-y-5">
      <div className="card p-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-surface-500 uppercase">Workspace Health Score</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={cn('text-4xl font-bold', scoreColor)}>{report.healthScore}</span>
            <span className="text-sm text-surface-500">/ 100</span>
          </div>
          <p className="text-xs text-surface-500 mt-1">
            {report.totals.contacts} contacts · {report.totals.deals} deals · {report.totals.invoices} invoices
          </p>
        </div>
        <Sparkles className="w-10 h-10 text-brand-400" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {report.issues.map(issue => (
          <button
            key={issue.id}
            onClick={() => setSelected(issue)}
            className={cn(
              'card p-4 text-left transition-all border-2 hover:shadow-md',
              issue.count === 0
                ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-500/5'
                : issue.severity === 'high'
                  ? 'border-rose-200 bg-rose-50/30 dark:bg-rose-500/5'
                  : issue.severity === 'medium'
                    ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-500/5'
                    : 'border-surface-100 dark:border-surface-800',
            )}
          >
            <p className="text-[10px] font-semibold text-surface-500 uppercase">{issue.type}</p>
            <p className="text-2xl font-bold text-surface-900 dark:text-surface-50 mt-1">{issue.count}</p>
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">{issue.label}</p>
          </button>
        ))}
      </div>

      {selected && <IssueDrawer issue={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function IssueDrawer({ issue, onClose }: { issue: QualityIssue; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-surface-900 rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-surface-50">{issue.label}</h3>
            <p className="text-sm text-surface-500 mt-1">
              {issue.count} record{issue.count !== 1 ? 's' : ''} affected
            </p>
          </div>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2 mt-4">
          <Link
            href={issue.action_url}
            className="btn-primary btn-sm w-full justify-center"
          >
            <Users className="w-4 h-4" /> View affected records
          </Link>
          <p className="text-[11px] text-surface-500 text-center">
            Use filters on the destination page to bulk-fix these issues.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Import Tab ─────────────────────────────────────────────────

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: 'ignore', label: 'Ignore' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'job_title', label: 'Job title' },
  { value: 'address', label: 'Address' },
  { value: 'website', label: 'Website' },
  { value: 'notes', label: 'Notes' },
  { value: 'tags', label: 'Tags' },
  { value: 'value', label: 'Deal value' },
  { value: 'stage', label: 'Deal stage' },
  { value: 'close_date', label: 'Close date' },
]

function ImportTab() {
  const [entity, setEntity] = useState<'contacts' | 'companies' | 'deals'>('contacts')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; total: number; errors: { row: number; error: string }[] } | null>(null)

  const sampleRows = useMemo(() => rows.slice(0, 5), [rows])

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsvText(text)
    if (parsed.length < 2) {
      toast.error('CSV needs at least a header and one data row')
      return
    }
    const hdrs = parsed[0]
    const dataRows = parsed.slice(1)
    setHeaders(hdrs)
    setRows(dataRows)
    const detected = detectColumns(hdrs, dataRows.slice(0, 10))
    setMapping(detected)
    setResult(null)
  }

  const runImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, rows, mapping }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error?.message || 'Import failed')
      setResult(j.data)
      toast.success(`Imported ${j.data.inserted} / ${j.data.total}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-surface-600 uppercase">Import as</label>
        <select
          value={entity}
          onChange={e => setEntity(e.target.value as 'contacts' | 'companies' | 'deals')}
          className="input input-sm"
        >
          <option value="contacts">Contacts</option>
          <option value="companies">Companies</option>
          <option value="deals">Deals</option>
        </select>
      </div>

      {headers.length === 0 ? (
        <label className="card p-10 border-2 border-dashed border-surface-200 dark:border-surface-800 flex flex-col items-center justify-center cursor-pointer hover:border-brand-400 transition-colors">
          <Upload className="w-10 h-10 text-surface-400 mb-3" />
          <p className="text-sm font-semibold text-surface-900 dark:text-surface-50">Drop a CSV file or click to browse</p>
          <p className="text-xs text-surface-500 mt-1">We will auto-detect columns using AI heuristics</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Column mapping ({rows.length} rows)
              </h4>
              <button
                onClick={() => {
                  setHeaders([])
                  setRows([])
                  setMapping({})
                  setResult(null)
                }}
                className="btn-secondary btn-sm"
              >
                <X className="w-4 h-4" /> Reset
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {headers.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-surface-900 dark:text-surface-50 truncate">{h || `Column ${idx + 1}`}</p>
                    <p className="text-[10px] text-surface-500 truncate">
                      e.g. {sampleRows.map(r => r[idx]).filter(Boolean).slice(0, 2).join(', ') || '—'}
                    </p>
                  </div>
                  <select
                    value={mapping[idx] || 'ignore'}
                    onChange={e =>
                      setMapping(prev => ({ ...prev, [idx]: e.target.value as FieldKey }))
                    }
                    className="input input-sm w-32"
                  >
                    {FIELD_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={runImport}
            disabled={importing}
            className="btn-primary"
          >
            {importing ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Import {rows.length} rows
          </button>

          {result && (
            <div className="card p-4">
              <p className="text-sm font-bold text-surface-900 dark:text-surface-50">
                Imported {result.inserted} / {result.total}
              </p>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-64 overflow-auto">
                  <p className="text-xs font-semibold text-rose-600 mb-1">
                    {result.errors.length} error(s):
                  </p>
                  <ul className="text-xs text-surface-600 space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
