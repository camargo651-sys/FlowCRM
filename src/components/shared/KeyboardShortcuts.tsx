'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Global keyboard shortcuts:
 * Cmd+K: Global search (handled by GlobalSearch)
 * Cmd+Shift+C: New contact
 * Cmd+Shift+D: New deal
 * Cmd+Shift+I: New invoice
 * G then D: Go to dashboard
 * G then P: Go to pipeline
 * G then C: Go to contacts
 */
export default function KeyboardShortcuts() {
  const router = useRouter()

  useEffect(() => {
    let gPressed = false
    let gTimeout: NodeJS.Timeout

    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      // G + key navigation
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        gPressed = true
        clearTimeout(gTimeout)
        gTimeout = setTimeout(() => { gPressed = false }, 500)
        return
      }

      if (gPressed) {
        gPressed = false
        switch (e.key) {
          case 'd': router.push('/dashboard'); break
          case 'p': router.push('/pipeline'); break
          case 'c': router.push('/contacts'); break
          case 'i': router.push('/invoices'); break
          case 'n': router.push('/inventory'); break
          case 'h': router.push('/hr'); break
          case 's': router.push('/settings'); break
        }
        return
      }

      // ? to show shortcuts help
      if (e.key === '?' && !e.metaKey) {
        // Could show a modal — for now just log
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(gTimeout)
    }
  }, [router])

  return null
}
