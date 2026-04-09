'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { t as translate, type Locale } from './translations'
import { createClient } from '@/lib/supabase/client'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
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
      if (ws?.language) setLocaleState(ws.language as Locale)
    }
    loadLocale()
  }, [])

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale)
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
