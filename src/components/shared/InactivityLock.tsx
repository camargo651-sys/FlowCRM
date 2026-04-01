'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Lock, LogIn } from 'lucide-react'

const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export default function InactivityLock() {
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const lastActivity = useRef(Date.now())
  const supabase = createClient()

  useEffect(() => {
    // Check if remember-me is set
    if (localStorage.getItem('tracktio_remember_me') === 'true') return

    const updateActivity = () => { lastActivity.current = Date.now() }

    const checkInactivity = setInterval(() => {
      if (Date.now() - lastActivity.current > TIMEOUT_MS && !locked) {
        setLocked(true)
      }
    }, 10000)

    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)
    window.addEventListener('scroll', updateActivity)

    // Get email
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })

    return () => {
      clearInterval(checkInactivity)
      window.removeEventListener('mousemove', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('scroll', updateActivity)
    }
  }, [locked])

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Incorrect password'); return }
    setLocked(false)
    setPassword('')
    lastActivity.current = Date.now()
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[100] bg-surface-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="text-lg font-bold text-surface-900 mb-1">Session Locked</h2>
        <p className="text-xs text-surface-500 mb-6">Enter your password to continue</p>

        <form onSubmit={unlock} className="space-y-3">
          <div className="text-xs text-surface-400 bg-surface-50 rounded-lg px-3 py-2">{email}</div>
          <input type="password" className="input w-full text-center" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} autoFocus />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            <LogIn className="w-4 h-4" /> Unlock
          </button>
        </form>

        <label className="flex items-center gap-2 mt-4 justify-center cursor-pointer">
          <input type="checkbox" className="rounded border-surface-300"
            onChange={e => localStorage.setItem('tracktio_remember_me', e.target.checked ? 'true' : 'false')} />
          <span className="text-[10px] text-surface-400">Remember me (disable auto-lock)</span>
        </label>
      </div>
    </div>
  )
}
