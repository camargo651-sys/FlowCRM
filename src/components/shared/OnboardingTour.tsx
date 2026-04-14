'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TourStep {
  selector: string
  title: string
  description: string
  side?: 'right' | 'bottom' | 'left' | 'top'
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="sales"]',
    title: 'Sales',
    description: 'Esto es Sales. Tu pipeline, contactos, cotizaciones y tareas viven aquí.',
    side: 'right',
  },
  {
    selector: '[data-tour="marketing"]',
    title: 'Marketing',
    description: 'Aquí gestionas campañas, leads, formularios y secuencias.',
    side: 'right',
  },
  {
    selector: '[data-tour="inbox"]',
    title: 'Inbox unificado',
    description: 'Toda tu comunicación: WhatsApp, email, SMS y registro de llamadas en un solo lugar.',
    side: 'right',
  },
  {
    selector: '[data-tour="quick-create"]',
    title: 'Quick Create',
    description: 'Crea contactos, deals, facturas y tareas desde aquí en segundos.',
    side: 'left',
  },
  {
    selector: '[data-tour="settings"]',
    title: 'Settings',
    description: 'Personaliza módulos, roles, automatizaciones y todo tu workspace.',
    side: 'right',
  },
]

const STORAGE_KEY = 'tracktio_tour_completed'

interface Rect { top: number; left: number; width: number; height: number }

export default function OnboardingTour() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)

  const start = useCallback(() => {
    setStep(0)
    setActive(true)
  }, [])

  // Auto-start logic
  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = localStorage.getItem(STORAGE_KEY) === 'true'
    if (completed) return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const created = user.created_at ? new Date(user.created_at).getTime() : 0
      const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24)
      if (ageDays < 7) {
        // Delay so the layout has mounted with data-tour markers
        setTimeout(() => start(), 800)
      }
    })
  }, [start])

  // Listen for manual trigger
  useEffect(() => {
    const handler = () => start()
    window.addEventListener('tracktio:start-tour', handler)
    return () => window.removeEventListener('tracktio:start-tour', handler)
  }, [start])

  // Compute spotlight rect for current step
  useEffect(() => {
    if (!active) return
    const measure = () => {
      const el = document.querySelector(STEPS[step].selector) as HTMLElement | null
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    const t = setTimeout(measure, 100)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, step])

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setActive(false)
  }, [])

  const next = () => {
    if (step >= STEPS.length - 1) finish()
    else setStep(step + 1)
  }

  if (!active) return null

  const current = STEPS[step]
  const padding = 8
  const sx = rect ? rect.left - padding : 0
  const sy = rect ? rect.top - padding : 0
  const sw = rect ? rect.width + padding * 2 : 0
  const sh = rect ? rect.height + padding * 2 : 0

  // Tooltip positioning
  let tipStyle: React.CSSProperties = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  if (rect) {
    const side = current.side || 'right'
    if (side === 'right') {
      tipStyle = { top: sy + sh / 2, left: sx + sw + 16, transform: 'translateY(-50%)' }
    } else if (side === 'left') {
      tipStyle = { top: sy + sh / 2, left: sx - 16, transform: 'translate(-100%, -50%)' }
    } else if (side === 'bottom') {
      tipStyle = { top: sy + sh + 16, left: sx + sw / 2, transform: 'translateX(-50%)' }
    } else {
      tipStyle = { top: sy - 16, left: sx + sw / 2, transform: 'translate(-50%, -100%)' }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with cutout */}
      {rect ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={() => { /* swallow */ }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={sx} y={sy} width={sw} height={sh} rx="12" fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.65)" mask="url(#tour-mask)" />
          <rect x={sx} y={sy} width={sw} height={sh} rx="12" fill="none" stroke="#0891B2" strokeWidth="2" />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-surface-900/60 pointer-events-auto" />
      )}

      {/* Tooltip */}
      <div
        className="absolute pointer-events-auto bg-white rounded-2xl shadow-modal p-5 w-[320px] animate-scale-in"
        style={tipStyle}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-[11px] text-surface-400 hover:text-surface-600"
          >
            Skip tour
          </button>
        </div>
        <h3 className="font-semibold text-surface-900 text-base mb-1.5">{current.title}</h3>
        <p className="text-sm text-surface-500 mb-4">{current.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-brand-600' : 'bg-surface-200'}`}
              />
            ))}
          </div>
          <button onClick={next} className="btn-primary btn-sm">
            {step >= STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
