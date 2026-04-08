'use client'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export default function MobileNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button - only on mobile */}
      <button onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-white/90 backdrop-blur-sm border border-surface-200 rounded-xl flex items-center justify-center shadow-card">
        <Menu className="w-5 h-5 text-surface-600" />
      </button>

      {/* Desktop sidebar - always visible */}
      <div className="hidden lg:block">
        {children}
      </div>

      {/* Mobile sidebar - slide in */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 animate-slide-in-right shadow-modal" onClick={() => setOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </>
  )
}
