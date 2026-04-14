'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Check, Upload, Key, Database, Loader2, ExternalLink, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Source = 'hubspot' | 'pipedrive' | 'zoho' | 'salesforce' | 'csv'

interface SourceInfo {
  id: Source
  name: string
  logo: string
  mode: 'api' | 'csv' | 'coming-soon'
  apiGuide?: { title: string; steps: string[]; docs: string }
  description: string
}

const SOURCES: SourceInfo[] = [
  {
    id: 'hubspot',
    name: 'HubSpot',
    logo: 'HS',
    mode: 'api',
    description: 'Migrate contacts, companies and deals via Private App token',
    apiGuide: {
      title: 'How to get a HubSpot Private App token',
      steps: [
        'Log in to HubSpot and click Settings (gear icon) in the top nav.',
        'In the left sidebar, go to Integrations → Private Apps.',
        'Click "Create a private app".',
        'In the "Scopes" tab, enable: crm.objects.contacts.read, crm.objects.companies.read, crm.objects.deals.read.',
        'Click "Create app" and copy the access token shown.',
        'Paste the token below.',
      ],
      docs: 'https://developers.hubspot.com/docs/api/private-apps',
    },
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    logo: 'PD',
    mode: 'api',
    description: 'Migrate persons, organizations and deals via API token',
    apiGuide: {
      title: 'How to get your Pipedrive API token',
      steps: [
        'Log in to Pipedrive.',
        'Click your profile picture (top right) → Personal preferences.',
        'Go to the "API" tab.',
        'Copy your personal API token.',
        'Paste the token below.',
      ],
      docs: 'https://pipedrive.readme.io/docs/how-to-find-the-api-token',
    },
  },
  {
    id: 'zoho',
    name: 'Zoho CRM',
    logo: 'ZC',
    mode: 'api',
    description: 'Migrate contacts, accounts and deals via OAuth token',
    apiGuide: {
      title: 'How to get a Zoho CRM OAuth access token',
      steps: [
        'Open https://api-console.zoho.com and click "ADD CLIENT" → "Self Client".',
        'Under the "Generate Code" tab, enter scope: ZohoCRM.modules.ALL',
        'Set time duration (e.g., 10 min) and click "CREATE".',
        'Copy the generated code, then exchange it for a token (or use the Self Client "Token" quickly).',
        'Paste the access token below.',
      ],
      docs: 'https://www.zoho.com/crm/developer/docs/api/v2/auth-request.html',
    },
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    logo: 'SF',
    mode: 'coming-soon',
    description: 'Coming soon — requires Connected App OAuth2 setup',
  },
  {
    id: 'csv',
    name: 'Generic CSV',
    logo: 'CSV',
    mode: 'csv',
    description: 'Upload a CSV file with any schema — we will map fields in the next step',
  },
]

type Step = 1 | 2 | 3 | 4 | 5

interface PreviewData {
  contacts?: { imported: number; total: number; errors: string[] }
  companies?: { imported: number; total: number; errors: string[] }
  deals?: { imported: number; total: number; errors: string[] }
}

interface WizardState {
  step: Step
  source: Source | null
  apiKey: string
  csvFile: string | null // file name, for UI only (File can't serialize)
  entities: string[]
  preview: PreviewData | null
  mapping: Record<string, string>
}

const LS_KEY = 'tracktio_migrate_wizard_v1'

export default function MigrateWizardPage() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    source: null,
    apiKey: '',
    csvFile: null,
    entities: ['contacts', 'companies', 'deals'],
    preview: null,
    mapping: {},
  })
  const [file, setFile] = useState<File | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PreviewData | null>(null)
  const [progress, setProgress] = useState(0)

  // Restore progress
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as WizardState
        setState(s => ({ ...s, ...parsed }))
      }
    } catch {}
  }, [])

  // Persist progress (except file)
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch {}
  }, [state])

  const source = SOURCES.find(s => s.id === state.source)
  const update = useCallback((patch: Partial<WizardState>) => setState(s => ({ ...s, ...patch })), [])

  const reset = () => {
    try { localStorage.removeItem(LS_KEY) } catch {}
    setState({ step: 1, source: null, apiKey: '', csvFile: null, entities: ['contacts', 'companies', 'deals'], preview: null, mapping: {} })
    setFile(null); setResult(null); setProgress(0)
  }

  const goNext = () => update({ step: Math.min(5, state.step + 1) as Step })
  const goBack = () => update({ step: Math.max(1, state.step - 1) as Step })

  // Fetch a preview (API sources only)
  const fetchPreview = async () => {
    if (!source || source.mode !== 'api') return
    setRunning(true)
    try {
      const res = await fetch(`/api/migrate/${source.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: state.apiKey, entities: state.entities, preview: true }),
      })
      const j = await res.json()
      if (!res.ok) {
        toast.error(j.error || 'Preview failed')
        setRunning(false)
        return
      }
      update({ preview: j.result, step: 3 })
    } catch (e) {
      toast.error((e as Error).message)
    }
    setRunning(false)
  }

  // Run actual migration
  const runMigration = async () => {
    if (!source) return
    setRunning(true)
    setProgress(10)
    try {
      if (source.mode === 'csv') {
        if (!file) { toast.error('No file selected'); setRunning(false); return }
        const form = new FormData()
        form.append('file', file)
        form.append('type', 'contacts')
        setProgress(40)
        const res = await fetch('/api/import', { method: 'POST', body: form })
        const j = await res.json()
        setProgress(100)
        if (!res.ok) { toast.error(j.error || 'Import failed'); setRunning(false); return }
        setResult({ contacts: { imported: j.imported, total: j.total, errors: j.errors || [] } })
        update({ step: 5 })
      } else if (source.mode === 'api') {
        setProgress(30)
        const res = await fetch(`/api/migrate/${source.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: state.apiKey, entities: state.entities, preview: false }),
        })
        const j = await res.json()
        setProgress(100)
        if (!res.ok) { toast.error(j.error || 'Migration failed'); setRunning(false); return }
        setResult(j.result)
        update({ step: 5 })
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
    setRunning(false)
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Database className="w-5 h-5" /> Migrate from another CRM</h1>
          <p className="page-subtitle">Import your data from HubSpot, Pipedrive, Zoho, Salesforce, or a CSV file</p>
        </div>
        <Link href="/settings" className="btn-secondary btn-sm">Back to settings</Link>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {([1, 2, 3, 4, 5] as const).map(s => (
          <div key={s} className="flex-1 flex items-center">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all',
              state.step >= s
                ? 'bg-brand-500 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-400'
            )}>
              {state.step > s ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            {s < 5 && (
              <div className={cn('h-0.5 flex-1 mx-1', state.step > s ? 'bg-brand-500' : 'bg-surface-100 dark:bg-surface-800')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Source selection */}
      {state.step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-surface-500 mb-2">Choose where your data is coming from:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.mode === 'coming-soon') {
                    toast.info(`${s.name} migration is coming soon.`)
                    return
                  }
                  update({ source: s.id, step: 2 })
                }}
                className={cn(
                  'card p-4 text-left hover:border-brand-300 hover:shadow-sm transition-all flex items-start gap-3',
                  state.source === s.id && 'ring-2 ring-brand-300',
                  s.mode === 'coming-soon' && 'opacity-60'
                )}
              >
                <div className="w-11 h-11 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 text-brand-700 font-extrabold text-sm">
                  {s.logo}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-surface-900">{s.name}</p>
                    {s.mode === 'coming-soon' && <span className="badge badge-gray text-[9px]">SOON</span>}
                  </div>
                  <p className="text-xs text-surface-500 mt-1">{s.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Auth / upload */}
      {state.step === 2 && source && (
        <div className="space-y-4">
          {source.mode === 'csv' ? (
            <div className="card p-6">
              <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload CSV file
              </h3>
              <p className="text-xs text-surface-500 mb-4">We will try to auto-detect columns in the next step.</p>
              <label className="block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => {
                    const f = e.target.files?.[0] || null
                    setFile(f)
                    update({ csvFile: f?.name || null })
                  }}
                  className="block w-full text-xs text-surface-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100 file:text-xs"
                />
              </label>
              {state.csvFile && (
                <p className="text-xs text-brand-600 mt-2 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {state.csvFile}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="card p-5">
                <h3 className="font-semibold text-surface-900 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" /> {source.apiGuide?.title}
                </h3>
                <ol className="text-xs text-surface-600 space-y-1.5 mb-3 list-decimal pl-4">
                  {source.apiGuide?.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                {source.apiGuide?.docs && (
                  <a
                    href={source.apiGuide.docs} target="_blank" rel="noreferrer"
                    className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
                  >
                    Official docs <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div>
                <label className="label">API Key / Access Token</label>
                <input
                  type="password"
                  className="input font-mono text-xs"
                  value={state.apiKey}
                  onChange={e => update({ apiKey: e.target.value })}
                  placeholder="Paste your token here"
                />
              </div>
              <div>
                <label className="label">Entities to import</label>
                <div className="flex flex-wrap gap-2">
                  {['contacts', 'companies', 'deals'].map(ent => (
                    <label key={ent} className={cn(
                      'px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-colors capitalize',
                      state.entities.includes(ent)
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'border-surface-200 text-surface-500'
                    )}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={state.entities.includes(ent)}
                        onChange={e => {
                          if (e.target.checked) update({ entities: [...state.entities, ent] })
                          else update({ entities: state.entities.filter(x => x !== ent) })
                        }}
                      />
                      {ent}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="flex items-center justify-between pt-2">
            <button onClick={goBack} className="btn-secondary btn-sm flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            {source.mode === 'csv' ? (
              <button
                disabled={!file}
                onClick={() => update({ step: 3 })}
                className="btn-primary btn-sm disabled:opacity-40 flex items-center gap-1"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                disabled={!state.apiKey || running}
                onClick={fetchPreview}
                className="btn-primary btn-sm disabled:opacity-40 flex items-center gap-1"
              >
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                {running ? 'Fetching preview…' : 'Preview import'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {state.step === 3 && source && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-3">Preview</h3>
            {source.mode === 'csv' ? (
              <p className="text-xs text-surface-600">
                CSV file: <span className="font-semibold">{state.csvFile}</span><br />
                The generic importer will auto-detect columns like <code>name, email, phone, company</code>.
              </p>
            ) : state.preview ? (
              <div className="grid grid-cols-3 gap-3">
                {(['contacts', 'companies', 'deals'] as const).map(k => state.preview?.[k] && (
                  <div key={k} className="rounded-lg bg-surface-50 dark:bg-surface-800 p-3 text-center">
                    <p className="text-[10px] uppercase text-surface-400 font-bold">{k}</p>
                    <p className="text-2xl font-extrabold text-brand-600">{state.preview[k]?.total ?? 0}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-surface-400">No preview data</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="btn-secondary btn-sm flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button onClick={goNext} className="btn-primary btn-sm flex items-center gap-1">
              Configure mapping <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Mapping */}
      {state.step === 4 && source && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-surface-900 mb-2">Field mapping</h3>
            <p className="text-xs text-surface-500 mb-4">
              {source.mode === 'api'
                ? `Default mapping is preconfigured for ${source.name}. Review and adjust if needed.`
                : 'We will auto-detect columns from your CSV header row.'}
            </p>
            <div className="space-y-2 text-xs">
              {[
                ['name', 'Name / Full name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['company_name', 'Company'],
                ['job_title', 'Job title'],
              ].map(([target, label]) => (
                <div key={target} className="grid grid-cols-2 gap-2 items-center">
                  <div className="text-surface-500">{label}</div>
                  <input
                    className="input text-xs"
                    placeholder={`${source.id} field (auto)`}
                    value={state.mapping[target] || ''}
                    onChange={e => update({ mapping: { ...state.mapping, [target]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-surface-400 mt-3">TODO: load actual source schema and provide dropdowns per field.</p>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={goBack} className="btn-secondary btn-sm flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={runMigration}
              disabled={running}
              className="btn-primary btn-sm flex items-center gap-1 disabled:opacity-40"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {running ? 'Importing…' : 'Start import'}
            </button>
          </div>
          {running && (
            <div className="w-full h-2 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Step 5: Result */}
      {state.step === 5 && (
        <div className="space-y-4">
          <div className="card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-surface-900 mb-1">Import complete</h3>
            <p className="text-xs text-surface-500 mb-4">Your data has been imported from {source?.name}.</p>
            {result && (
              <div className="grid grid-cols-3 gap-2">
                {(['contacts', 'companies', 'deals'] as const).map(k => result[k] && (
                  <div key={k} className="rounded-lg bg-surface-50 dark:bg-surface-800 p-2">
                    <p className="text-[10px] uppercase text-surface-400 font-bold">{k}</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {result[k]?.imported}<span className="text-surface-400 text-xs"> / {result[k]?.total}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={reset} className="btn-secondary btn-sm">Start over</button>
            <Link href="/contacts" className="btn-primary btn-sm">Go to contacts</Link>
          </div>
        </div>
      )}
    </div>
  )
}
