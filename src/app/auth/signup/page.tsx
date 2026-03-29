'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, User, Building2, ArrowRight } from 'lucide-react'
import { slugify } from '@/lib/utils'

export default function SignupPage() {
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

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
        }
      }
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }
    if (data.user) router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-8">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">FlowCRM</span>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">Create your workspace</h1>
        <p className="text-surface-400 text-sm mb-8">Free forever. No credit card required.</p>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-brand-500' : 'bg-surface-800'}`} />
          ))}
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2) } : handleSignup} className="space-y-4">
          {step === 1 ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">Your name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">Company / Workspace name</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="text" required value={workspaceName} onChange={e => setWorkspaceName(e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
                {workspaceName && (
                  <p className="text-surface-500 text-xs mt-1.5">URL: flowcrm.app/<span className="text-brand-400">{slugify(workspaceName)}</span></p>
                )}
              </div>
              <button type="submit" disabled={!fullName || !workspaceName}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 mt-2">
                <span>Continue</span><ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">Work email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="jane@acme.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-400 mb-1.5 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                  <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-900 border border-surface-700 rounded-xl text-white placeholder-surface-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all" />
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-950/50 border border-red-800 rounded-xl text-red-400 text-xs">{error}</div>
              )}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-surface-700 text-surface-400 hover:text-white hover:border-surface-600 text-sm font-medium transition-all">
                  Back
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50">
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create workspace'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-surface-500 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
