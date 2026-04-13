'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import LocaleSwitcher from '@/components/shared/LocaleSwitcher'

export default function LoginPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  const handleDemo = async () => {
    setDemoLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/demo', { method: 'POST' })
      const data = await res.json()
      if (data.access_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        router.push('/dashboard')
      } else {
        setError(data.error || 'Demo not available')
        setDemoLoading(false)
      }
    } catch {
      setError('Demo not available right now')
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex relative">
      <div className="absolute top-4 right-4 z-20">
        <LocaleSwitcher variant="dark" />
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-surface-950" />
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/10">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Tracktio</span>
          </div>
          <p className="text-white/50 text-sm mt-3">{t('landing.hero.tagline')}</p>
        </div>
        <div className="relative z-10 space-y-6">
          <blockquote className="text-white/90 text-2xl font-light leading-relaxed">
            {t('auth.login.quote')}
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">MR</div>
            <div>
              <p className="text-white font-medium text-sm">María Rodríguez</p>
              <p className="text-white/60 text-xs">Sales Director, SolarTech EMEA</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex gap-8">
          {[['27', t('auth.login.stats.modules')], ['60s', t('auth.login.stats.setup')], ['$0', t('auth.login.stats.free')]].map(([val, label]) => (
            <div key={label}>
              <p className="text-white font-bold text-2xl">{val}</p>
              <p className="text-white/60 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Tracktio</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">{t('auth.login.title')}</h1>
          <p className="text-surface-400 text-sm mb-8">{t('auth.login.subtitle')}</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">{t('auth.login.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 mt-2">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><span>{t('auth.login.submit')}</span><ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-800" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-surface-950 px-3 text-surface-500">{t('auth.login.or')}</span></div>
          </div>

          <button onClick={handleDemo} disabled={demoLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-surface-700 text-surface-300 hover:text-white hover:border-surface-500 font-medium text-sm transition-all disabled:opacity-50">
            {demoLoading ? (
              <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" />
            ) : (
              <><Zap className="w-4 h-4" /> {t('auth.login.demo')}</>
            )}
          </button>

          <p className="text-center text-surface-500 text-sm mt-6">
            {t('auth.login.no_account')}{' '}
            <Link href="/auth/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              {t('auth.login.create')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
