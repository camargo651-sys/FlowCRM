'use client'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, User, Building2, ArrowRight, Check, X } from 'lucide-react'
import { slugify } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/track'
import { useI18n } from '@/lib/i18n/context'
import LocaleSwitcher from '@/components/shared/LocaleSwitcher'

const STARTER_MODULES = [
  { key: 'crm', icon: '🔀' },
  { key: 'invoicing', icon: '🧾' },
  { key: 'whatsapp', icon: '💬' },
  { key: 'inventory', icon: '📦' },
  { key: 'pos', icon: '💳' },
  { key: 'tickets', icon: '🎫' },
] as const

type ModuleKey = typeof STARTER_MODULES[number]['key']

function SignupInner() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const urlModule = searchParams.get('module') as ModuleKey | null
  const validUrlModule = urlModule && STARTER_MODULES.some(m => m.key === urlModule) ? urlModule : null

  const [selectedModule, setSelectedModule] = useState<ModuleKey | null>(validUrlModule)
  // Steps: 0 = pick module (only if none picked yet), 1 = name/company, 2 = email/password
  const [step, setStep] = useState<number>(validUrlModule ? 1 : 0)
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (validUrlModule) setSelectedModule(validUrlModule)
  }, [validUrlModule])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          full_name: fullName,
          workspace_name: workspaceName,
          workspace_slug: slugify(workspaceName),
          initial_module: selectedModule || null,
        }
      }
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) {
      trackEvent('signup_completed', { initial_module: selectedModule || 'none' })
      router.push('/dashboard')
    }
  }

  const selectedMeta = STARTER_MODULES.find(m => m.key === selectedModule)

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6 relative">
      <div className="absolute top-4 right-4 z-20">
        <LocaleSwitcher variant="dark" />
      </div>

      <div className={`w-full ${step === 0 ? 'max-w-3xl' : 'max-w-sm'} animate-slide-up`}>
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Tracktio</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">{t('auth.signup.title')}</h1>
        <p className="text-surface-400 text-sm mb-6">{t('auth.signup.subtitle')}</p>

        {/* Perks row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-6 text-[11px] font-medium text-surface-400">
          <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> {t('landing.perks.sixty')}</span>
          <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> {t('landing.perks.nocard')}</span>
          <span className="inline-flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> {t('landing.perks.free_forever')}</span>
        </div>

        {/* Module badge (always visible when a module is selected) */}
        {selectedMeta && step > 0 && (
          <div className="mb-6 flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-xl">{selectedMeta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">{t('auth.signup.starting_with')}</p>
              <p className="text-sm font-semibold text-white truncate">
                {t(`landing.modules.${selectedMeta.key}`)} · <span className="text-emerald-300 font-normal">{t('auth.signup.free_forever')}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedModule(null); setStep(0) }}
              className="text-surface-400 hover:text-white transition-colors"
              aria-label="Change module"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {step > 0 && (
          <div className="flex gap-2 mb-6">
            {[1, 2].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-brand-500' : 'bg-surface-800'}`} />
            ))}
          </div>
        )}

        {/* Step 0: pick module */}
        {step === 0 && (
          <div>
            <h2 className="text-lg font-bold text-white mb-1">{t('auth.signup.pick_module')}</h2>
            <p className="text-surface-400 text-sm mb-5">{t('auth.signup.pick_module_sub')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STARTER_MODULES.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { setSelectedModule(m.key); setStep(1) }}
                  className="group text-left p-4 rounded-xl bg-surface-900 border border-surface-800 hover:border-emerald-500 hover:bg-surface-900/80 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center text-xl transition-colors">
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{t(`landing.modules.${m.key}`)}</p>
                      <p className="text-xs text-surface-400 mt-0.5 leading-snug">{t(`landing.modules.${m.key}_desc`)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { setSelectedModule(null); setStep(1) }}
              className="mt-4 text-xs text-surface-500 hover:text-surface-300 font-medium transition-colors"
            >
              {t('auth.signup.skip')}
            </button>
          </div>
        )}

        {/* Steps 1 & 2 */}
        {step > 0 && (
          <form onSubmit={step === 1 ? (e) => { e.preventDefault(); trackEvent('signup_step_completed', { step: 1 }); setStep(2) } : (e) => { trackEvent('signup_step_completed', { step: 2 }); return handleSignup(e) }} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.signup.full_name')}</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.signup.company_name')}</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input type="text" required value={workspaceName} onChange={e => setWorkspaceName(e.target.value)}
                      placeholder="Acme Corp"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                  </div>
                  {workspaceName && (
                    <p className="text-surface-500 text-xs mt-1.5">URL: tracktio.app/<span className="text-brand-400">{slugify(workspaceName)}</span></p>
                  )}
                </div>
                <button type="submit" disabled={!fullName || !workspaceName}
                  className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 mt-2">
                  <span>{t('auth.signup.continue')}</span><ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.signup.email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="jane@acme.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.signup.password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder={t('auth.signup.password_hint')}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-400 text-xs">{error}</div>
                )}
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-surface-700 text-surface-400 hover:text-white hover:border-surface-600 text-sm font-medium transition-all">
                    {t('auth.signup.back')}
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('auth.signup.create')}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        <p className="text-center text-surface-500 text-sm mt-6">
          {t('auth.signup.have_account')}{' '}
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">{t('auth.signup.sign_in')}</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-950" />}>
      <SignupInner />
    </Suspense>
  )
}
