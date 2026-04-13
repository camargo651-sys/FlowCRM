'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { t as translate, type Locale } from './translations'
import { createClient } from '@/lib/supabase/client'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LOCALE_STORAGE_KEY = 'tracktio_locale'
const VALID_LOCALES: Locale[] = ['es', 'en', 'pt', 'fr', 'de']

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && (VALID_LOCALES as string[]).includes(stored)) return stored as Locale
  } catch {}
  return 'en'
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale)
  const supabase = createClient()

  useEffect(() => {
    const loadLocale = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const activeWsId = typeof window !== 'undefined' ? localStorage.getItem('tracktio_active_workspace') : null
      let ws: { language?: string } | null = null
      if (activeWsId) {
        const { data } = await supabase.from('workspaces').select('language').eq('id', activeWsId).limit(1)
        ws = data?.[0] || null
      }
      if (!ws) {
        const { data } = await supabase.from('workspaces').select('language').eq('owner_id', user.id).order('created_at').limit(1)
        ws = data?.[0] || null
      }
      if (ws?.language && (VALID_LOCALES as string[]).includes(ws.language)) {
        setLocaleState(ws.language as Locale)
        try { window.localStorage.setItem(LOCALE_STORAGE_KEY, ws.language) } catch {}
      }
    }
    loadLocale()
  }, [])

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale)
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(LOCALE_STORAGE_KEY, newLocale) } catch {}
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const activeWsId = typeof window !== 'undefined' ? localStorage.getItem('tracktio_active_workspace') : null
      if (activeWsId) {
        await supabase.from('workspaces').update({ language: newLocale }).eq('id', activeWsId)
      } else {
        await supabase.from('workspaces').update({ language: newLocale }).eq('owner_id', user.id)
      }
    }
  }, [])

  const t = useCallback((key: string) => translate(key, locale), [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
