'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import LocaleSwitcher from '@/components/shared/LocaleSwitcher'
import { ChevronDown } from 'lucide-react'

const NAV_LOGO = (
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
      <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    </div>
    <span className="font-bold text-xl tracking-tight text-surface-900">Tracktio</span>
  </div>
)

const STARTER_MODULES = [
  { key: 'crm', icon: '🔀' },
  { key: 'invoicing', icon: '🧾' },
  { key: 'whatsapp', icon: '💬' },
  { key: 'inventory', icon: '📦' },
  { key: 'pos', icon: '💳' },
  { key: 'tickets', icon: '🎫' },
] as const

const HOW_IT_WORKS_STEPS = [
  { step: '01', titleKey: 'landing.how_it_works.s1_title', descKey: 'landing.how_it_works.s1_desc' },
  { step: '02', titleKey: 'landing.how_it_works.s2_title', descKey: 'landing.how_it_works.s2_desc' },
  { step: '03', titleKey: 'landing.how_it_works.s3_title', descKey: 'landing.how_it_works.s3_desc' },
] as const

const WHY_SWITCH_CARDS = [
  {
    accent: 'brand',
    titleKey: 'landing.why_switch.c1_title',
    descKey: 'landing.why_switch.c1_desc',
    bullets: ['landing.why_switch.c1_b1', 'landing.why_switch.c1_b2', 'landing.why_switch.c1_b3', 'landing.why_switch.c1_b4'],
  },
  {
    accent: 'violet',
    titleKey: 'landing.why_switch.c2_title',
    descKey: 'landing.why_switch.c2_desc',
    bullets: ['landing.why_switch.c2_b1', 'landing.why_switch.c2_b2', 'landing.why_switch.c2_b3', 'landing.why_switch.c2_b4'],
  },
  {
    accent: 'emerald',
    titleKey: 'landing.why_switch.c3_title',
    descKey: 'landing.why_switch.c3_desc',
    bullets: ['landing.why_switch.c3_b1', 'landing.why_switch.c3_b2', 'landing.why_switch.c3_b3', 'landing.why_switch.c3_b4'],
  },
] as const

const ALL_MODULES = [
  { icon: '📊', key: 'dashboard', tag: 'AI' },
  { icon: '🔀', key: 'crm_pipeline', tag: '' },
  { icon: '👥', key: 'contacts', tag: 'AI' },
  { icon: '🧾', key: 'invoicing', tag: '' },
  { icon: '📄', key: 'quotes', tag: '' },
  { icon: '📦', key: 'inventory', tag: '' },
  { icon: '🏭', key: 'manufacturing', tag: '' },
  { icon: '🛒', key: 'ecommerce', tag: '' },
  { icon: '💳', key: 'pos', tag: '' },
  { icon: '📒', key: 'accounting', tag: '' },
  { icon: '🚛', key: 'purchasing', tag: '' },
  { icon: '👔', key: 'hr', tag: '' },
  { icon: '💬', key: 'whatsapp', tag: '' },
  { icon: '📧', key: 'email_sync', tag: 'AI' },
  { icon: '📈', key: 'analytics', tag: '' },
  { icon: '⚡', key: 'automations', tag: '' },
  { icon: '💰', key: 'expenses', tag: '' },
  { icon: '📸', key: 'social_leads', tag: '' },
  { icon: '📝', key: 'contracts', tag: '' },
  { icon: '🎫', key: 'tickets', tag: '' },
  { icon: '📞', key: 'call_tracking', tag: 'AI' },
  { icon: '💼', key: 'linkedin', tag: '' },
  { icon: '🔌', key: 'integrations', tag: '' },
  { icon: '🧱', key: 'form_builder', tag: '' },
  { icon: '📋', key: 'templates', tag: '' },
  { icon: '🛡️', key: 'rbac', tag: '' },
  { icon: '💻', key: 'api', tag: '' },
] as const

const COMPARISON_ROWS = [
  { labelKey: 'landing.comparison.r.setup_time', tracktioKey: 'landing.comparison.setup.tracktio', odooKey: 'landing.comparison.setup.odoo', sapKey: 'landing.comparison.setup.sap', zohoKey: 'landing.comparison.setup.zoho' },
  { labelKey: 'landing.comparison.r.cost', tracktio: '$0', odoo: '$5K-50K', sap: '$50K-500K', zoho: '$2K-10K' },
  { labelKey: 'landing.comparison.r.specialist', tracktioKey: 'landing.comparison.val.no', odooKey: 'landing.comparison.val.yes', sapKey: 'landing.comparison.val.yes', zohoKey: 'landing.comparison.val.partial' },
  { labelKey: 'landing.comparison.r.whatsapp', tracktioKey: 'landing.comparison.val.yes', odooKey: 'landing.comparison.val.addon', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.no' },
  { labelKey: 'landing.comparison.r.ai_scoring', tracktioKey: 'landing.comparison.val.yes', odooKey: 'landing.comparison.val.no', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.partial' },
  { labelKey: 'landing.comparison.r.email_sync', tracktioKey: 'landing.comparison.val.yes', odooKey: 'landing.comparison.val.addon', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.partial' },
  { labelKey: 'landing.comparison.r.manufacturing', tracktioKey: 'landing.comparison.val.included', odooKey: 'landing.comparison.val.included', sapKey: 'landing.comparison.val.included', zohoKey: 'landing.comparison.val.no' },
  { labelKey: 'landing.comparison.r.pos', tracktioKey: 'landing.comparison.val.yes', odooKey: 'landing.comparison.val.addon', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.addon' },
  { labelKey: 'landing.comparison.r.ecom', tracktioKey: 'landing.comparison.val.included', odooKey: 'landing.comparison.val.included', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.addon' },
  { labelKey: 'landing.comparison.r.hr', tracktioKey: 'landing.comparison.val.included', odooKey: 'landing.comparison.val.partial', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.partial' },
  { labelKey: 'landing.comparison.r.proposal', tracktioKey: 'landing.comparison.val.yes', odooKey: 'landing.comparison.val.no', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.no' },
  { labelKey: 'landing.comparison.r.industry', tracktio: '8+', odooKey: 'landing.comparison.val.limited', sapKey: 'landing.comparison.val.no', zohoKey: 'landing.comparison.val.no' },
] as const

const TESTIMONIALS = [
  { quoteKey: 'landing.testimonials.t1_quote', name: 'Maria Rodriguez', roleKey: 'landing.testimonials.t1_role', company: 'SolarTech EMEA' },
  { quoteKey: 'landing.testimonials.t2_quote', name: 'Carlos Mendez', roleKey: 'landing.testimonials.t2_role', company: 'LogiTrack MX' },
  { quoteKey: 'landing.testimonials.t3_quote', name: 'Ana Ruiz', roleKey: 'landing.testimonials.t3_role', company: 'Estudio Volta' },
] as const

export default function Home() {
  const { t } = useI18n()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [tryOpen, setTryOpen] = useState(false)
  const tryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (user) router.replace('/dashboard')
      else setChecked(true)
    })
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (tryRef.current && !tryRef.current.contains(e.target as Node)) setTryOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!checked) {
    return <div className="min-h-screen bg-white" />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-100/60">
        <div className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto">
          <Link href="/">{NAV_LOGO}</Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-surface-500 hover:text-surface-900 transition-colors">{t('landing.nav.features')}</Link>
            <Link href="/pricing" className="text-sm font-medium text-surface-500 hover:text-surface-900 transition-colors">{t('landing.nav.pricing')}</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher variant="light" />
            <Link href="/auth/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors hidden sm:block">{t('landing.nav.sign_in')}</Link>
            <div ref={tryRef} className="relative">
              <button
                type="button"
                onClick={() => setTryOpen(v => !v)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-all text-sm shadow-sm shadow-emerald-600/20"
              >
                {t('landing.nav.try_free')}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {tryOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-surface-200 bg-white shadow-xl z-50 p-2">
                  {STARTER_MODULES.map(m => (
                    <Link
                      key={m.key}
                      href={`/auth/signup?module=${m.key}`}
                      onClick={() => setTryOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 transition-colors"
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate">{t(`landing.modules.${m.key}`)}</p>
                        <p className="text-[11px] text-surface-500 truncate">{t(`landing.modules.${m.key}_desc`)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/auth/signup" className="hidden sm:inline-block px-5 py-2 bg-surface-900 text-white font-semibold rounded-xl hover:bg-surface-800 transition-all text-sm shadow-sm">
              {t('landing.nav.start_free')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/40 via-white to-white" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-400/8 rounded-full blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-50 border border-brand-100 text-brand-700 rounded-full text-xs font-semibold mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            {t('landing.hero.badge')}
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-surface-900 leading-[1.08] tracking-tight">
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">{t('landing.hero.tagline')}</span>
          </h1>
          <p className="text-xl sm:text-2xl text-surface-700 mt-5 max-w-2xl mx-auto font-semibold leading-snug">
            {t('landing.hero.subtitle')}
          </p>
          <p className="text-base sm:text-lg text-surface-500 mt-4 max-w-2xl mx-auto leading-relaxed">
            {t('landing.hero.description')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/auth/signup" className="px-10 py-4 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all text-base shadow-xl shadow-brand-600/25 hover:shadow-brand-600/40 hover:-translate-y-0.5 duration-200 w-full sm:w-auto text-center">
              {t('landing.hero.cta_primary')}
            </Link>
            <Link href="/features" className="px-8 py-3.5 bg-white text-surface-700 font-semibold rounded-xl border border-surface-200 hover:border-surface-300 hover:bg-surface-50 transition-all text-sm w-full sm:w-auto text-center">
              {t('landing.hero.cta_secondary')}
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 text-xs font-medium text-surface-500">
            <span className="inline-flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {t('landing.perks.sixty')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {t('landing.perks.nocard')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-emerald-500">✓</span> {t('landing.perks.free_forever')}</span>
          </div>
          <p className="text-sm text-surface-500 mt-6 font-medium">
            {t('landing.hero.social_proof')}
          </p>
          <p className="text-xs text-surface-400 mt-2">
            <Link href="/auth/login?demo=true" className="text-brand-600 font-semibold hover:underline">{t('landing.hero.demo_link')}</Link>
            {' '} — {t('landing.hero.demo_nosignup')}
          </p>
        </div>
      </section>

      {/* ── START FREE WITH ONE MODULE ── */}
      <section className="relative py-20 bg-gradient-to-b from-white via-emerald-50/30 to-white border-y border-surface-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">{t('landing.perks.free_forever')}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">{t('landing.modules.title')}</h2>
            <p className="text-surface-500 mt-4 max-w-xl mx-auto">{t('landing.modules.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STARTER_MODULES.map(m => (
              <Link
                key={m.key}
                href={`/auth/signup?module=${m.key}`}
                className="group relative p-6 bg-white rounded-2xl border border-surface-200 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-2xl transition-colors">
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-surface-900">{t(`landing.modules.${m.key}`)}</h3>
                    <p className="text-sm text-surface-500 mt-1 leading-snug">{t(`landing.modules.${m.key}_desc`)}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                      {t('landing.modules.pick')} <span aria-hidden>→</span>
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{t('landing.how_it_works.eyebrow')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">{t('landing.how_it_works.title')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS_STEPS.map(item => (
            <div key={item.step} className="relative">
              <span className="text-6xl font-black text-surface-100 leading-none">{item.step}</span>
              <h3 className="text-base font-bold text-surface-900 mt-3 mb-2">{t(item.titleKey)}</h3>
              <p className="text-sm text-surface-500 leading-relaxed">{t(item.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY SWITCH ── */}
      <section className="bg-surface-950 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3">{t('landing.why_switch.eyebrow')}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">{t('landing.why_switch.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_SWITCH_CARDS.map(card => {
              const border = card.accent === 'brand' ? 'hover:border-brand-600/40' : card.accent === 'violet' ? 'hover:border-violet-500/40' : 'hover:border-emerald-500/40'
              const bg = card.accent === 'brand' ? 'bg-brand-600/10' : card.accent === 'violet' ? 'bg-violet-500/10' : 'bg-emerald-500/10'
              const check = card.accent === 'brand' ? 'text-brand-400' : card.accent === 'violet' ? 'text-violet-400' : 'text-emerald-400'
              return (
                <div key={card.titleKey} className={`p-8 rounded-2xl bg-gradient-to-br from-surface-900 to-surface-950 border border-surface-800 transition-colors duration-300 ${border}`}>
                  <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-5`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${check.replace('text-', 'bg-')}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{t(card.titleKey)}</h3>
                  <p className="text-sm text-surface-400 leading-relaxed mb-5">{t(card.descKey)}</p>
                  <ul className="space-y-2.5 text-xs text-surface-300">
                    {card.bullets.map(b => (
                      <li key={b} className="flex items-center gap-2"><span className={check}>✓</span> {t(b)}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── ALL 27 MODULES GRID ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{t('landing.modules_grid.eyebrow')}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">{t('landing.modules_grid.title')}</h2>
            <p className="text-surface-500 mt-4 max-w-lg mx-auto">{t('landing.modules_grid.subtitle')}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ALL_MODULES.map(m => (
              <div key={m.key} className="group p-4 bg-white rounded-xl border border-surface-100 hover:border-brand-200 hover:shadow-lg transition-all duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xl">{m.icon}</span>
                  {m.tag && <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">{m.tag}</span>}
                </div>
                <p className="text-sm font-semibold text-surface-800 mt-2.5">{t(`landing.modules_grid.m.${m.key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="bg-surface-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{t('landing.comparison.eyebrow')}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">{t('landing.comparison.title')}</h2>
          </div>
          <div className="overflow-x-auto card p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-surface-200">
                  <th className="text-left py-4 px-5 text-surface-500 font-semibold text-xs uppercase tracking-wider">{t('landing.comparison.col_feature')}</th>
                  <th className="text-center py-4 px-5 font-bold text-brand-600 text-xs uppercase tracking-wider bg-brand-50/40">Tracktio</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">Odoo</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">SAP B1</th>
                  <th className="text-center py-4 px-5 text-surface-400 text-xs uppercase tracking-wider">Zoho</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {COMPARISON_ROWS.map((row, i) => {
                  const r = row as { labelKey: string; tracktio?: string; tracktioKey?: string; odoo?: string; odooKey?: string; sap?: string; sapKey?: string; zoho?: string; zohoKey?: string }
                  const cell = (literal?: string, key?: string) => (literal ?? (key ? t(key) : ''))
                  return (
                    <tr key={i} className="border-b border-surface-100 last:border-0">
                      <td className="py-3 px-5 font-medium text-surface-700">{t(r.labelKey)}</td>
                      <td className="py-3 px-5 text-center font-bold text-brand-600 bg-brand-50/40">{cell(r.tracktio, r.tracktioKey)}</td>
                      <td className="py-3 px-5 text-center text-surface-500">{cell(r.odoo, r.odooKey)}</td>
                      <td className="py-3 px-5 text-center text-surface-500">{cell(r.sap, r.sapKey)}</td>
                      <td className="py-3 px-5 text-center text-surface-500">{cell(r.zoho, r.zohoKey)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{t('landing.testimonials.eyebrow')}</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">{t('landing.testimonials.title')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(tm => (
              <div key={tm.name} className="card p-8">
                <div className="flex gap-1 mb-4">
                  {[0, 1, 2, 3, 4].map(i => (
                    <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-sm text-surface-600 leading-relaxed mb-6">&ldquo;{t(tm.quoteKey)}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xs">
                    {tm.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{tm.name}</p>
                    <p className="text-xs text-surface-400">{t(tm.roleKey)}, {tm.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT FORM ── */}
      <section className="bg-white py-20">
        <div className="max-w-md mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-surface-900 mb-2">{t('landing.final_cta.contact_title')}</h2>
          <p className="text-surface-500 text-sm mb-8">{t('landing.final_cta.contact_subtitle')}</p>
          <form action={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'hello@tracktio.app'}`} method="POST" encType="text/plain" className="space-y-3">
            <input type="text" name="name" required placeholder={t('landing.final_cta.name_ph')} className="input" />
            <input type="email" name="email" required placeholder={t('landing.final_cta.email_ph')} className="input" />
            <textarea name="message" required rows={3} placeholder={t('landing.final_cta.message_ph')} className="input resize-none" />
            <button type="submit" className="btn-primary w-full py-3">{t('landing.final_cta.submit')}</button>
          </form>
        </div>
      </section>

      {/* ── TRUSTED BY ── */}
      <section className="border-y border-surface-100 bg-surface-50/50 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-surface-400 uppercase tracking-widest mb-6">Trusted by growing companies worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5 opacity-50">
            {[
              { icon: '🏢', name: 'SolarTech' },
              { icon: '🚚', name: 'LogiTrack' },
              { icon: '🎨', name: 'Estudio Volta' },
              { icon: '💻', name: 'NexaCorp' },
              { icon: '🏥', name: 'MediFlow' },
              { icon: '🎓', name: 'EduPrime' },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="text-2xl">{c.icon}</span>
                <span className="text-lg font-bold text-surface-900 tracking-tight">{c.name}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-surface-400 mt-4">Replacing the tools you already use</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 mt-3 opacity-30">
            {['Odoo', 'SAP B1', 'Zoho', 'Monday', 'HubSpot', 'Freshworks'].map(name => (
              <span key={name} className="text-sm font-bold text-surface-900 tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Core features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Everything you need to grow</h2>
            <p className="text-surface-500 mt-4 max-w-lg mx-auto">Six powerful modules that work together seamlessly.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'CRM & Pipeline', desc: 'Visual deal pipeline with drag-and-drop stages, contact management, and activity tracking.', color: 'brand' },
              { title: 'WhatsApp Business', desc: 'Native WhatsApp integration with templates, bulk messaging, and conversation tracking.', color: 'emerald' },
              { title: 'AI-Powered Insights', desc: 'Engagement scoring, deal risk detection, and proactive next-action suggestions powered by AI.', color: 'violet' },
              { title: 'Sequences & Automation', desc: 'Multi-channel drip campaigns via email, WhatsApp, and SMS with conditional logic.', color: 'blue' },
              { title: 'Analytics & Reports', desc: 'Real-time dashboards, revenue forecasting, P&L reports, and team performance metrics.', color: 'amber' },
              { title: 'Client Portal', desc: 'Branded self-service portal for clients to view invoices, quotes, and project status.', color: 'rose' },
            ].map(f => (
              <div key={f.title} className="group p-6 bg-white rounded-2xl border border-surface-100 hover:border-brand-200 hover:shadow-xl transition-all duration-300">
                <div className={`w-12 h-12 bg-surface-50 group-hover:bg-${f.color}-50 rounded-xl flex items-center justify-center mb-4 transition-colors`}>
                  <span className={`w-2 h-2 rounded-full bg-${f.color}-500`} />
                </div>
                <h3 className="text-base font-bold text-surface-900 mb-2">{f.title}</h3>
                <p className="text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING PREVIEW ── */}
      <section className="bg-surface-50 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">Simple pricing</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-surface-900">Free to start. Scales with you.</h2>
          <p className="text-surface-500 mt-4 max-w-lg mx-auto">
            All 27 modules included in every plan. No per-module fees. No surprises.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { name: 'Free', price: '$0', desc: '1 user, 100 contacts' },
              { name: 'Starter', price: '$29', desc: '5 users, 1K contacts' },
              { name: 'Growth', price: '$79', desc: '20 users, unlimited', pop: true },
              { name: 'Scale', price: '$199', desc: 'Unlimited everything' },
            ].map(p => (
              <div key={p.name} className={`card p-5 text-center ${p.pop ? 'ring-2 ring-brand-500 shadow-lg shadow-brand-600/10' : ''}`}>
                {p.pop && <p className="text-[9px] font-bold text-brand-600 uppercase mb-1">Most popular</p>}
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{p.name}</p>
                <p className="text-2xl font-extrabold text-surface-900 mt-1">{p.price}<span className="text-sm font-medium text-surface-400">/mo</span></p>
                <p className="text-xs text-surface-400 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 mt-8 transition-colors">
            Compare all plans <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-surface-950" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Stop juggling 10 tools.<br />Run everything from one place.
          </h2>
          <p className="text-brand-200 mt-5 max-w-lg mx-auto text-base leading-relaxed">
            Join 500+ businesses that replaced their entire software stack with Tracktio. Free forever on the starter plan.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link href="/auth/signup" className="px-10 py-4 bg-white text-brand-700 font-bold rounded-xl hover:bg-brand-50 transition-all text-base shadow-xl hover:shadow-2xl hover:-translate-y-0.5 duration-200 w-full sm:w-auto text-center">
              {t('landing.hero.cta_primary')}
            </Link>
            <Link href="/auth/login?demo=true" className="px-8 py-3.5 text-white font-semibold rounded-xl border border-white/20 hover:bg-white/10 transition-all text-sm w-full sm:w-auto text-center">
              {t('landing.hero.demo_link')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-surface-950 text-surface-400 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span className="text-white font-bold text-lg">Tracktio</span>
            </div>
            <p className="text-xs">&copy; {new Date().getFullYear()} Tracktio. All rights reserved.</p>
            <LocaleSwitcher variant="dark" />
          </div>
        </div>
      </footer>
    </div>
  )
}
