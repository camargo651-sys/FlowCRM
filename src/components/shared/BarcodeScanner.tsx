'use client'
import { useEffect, useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  placeholder?: string
}

/**
 * Barcode scanner that works via:
 * 1. USB/Bluetooth barcode scanners (keyboard input)
 * 2. Manual text input
 * Listens for rapid keystrokes typical of barcode scanners.
 */
export default function BarcodeScanner({ onScan, placeholder = 'Scan barcode or type SKU...' }: BarcodeScannerProps) {
  const [buffer, setBuffer] = useState('')
  const [manual, setManual] = useState('')
  const lastKeyTime = useRef(0)
  const bufferRef = useRef('')

  useEffect(() => {
    let timeout: NodeJS.Timeout

    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input (except our own)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (!target.dataset.barcodeInput) return
      }

      const now = Date.now()
      const timeDiff = now - lastKeyTime.current
      lastKeyTime.current = now

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          onScan(bufferRef.current)
          bufferRef.current = ''
          setBuffer('')
        }
        return
      }

      if (e.key.length === 1) {
        // If rapid input (< 50ms between keys) = scanner
        if (timeDiff < 50 || bufferRef.current.length === 0) {
          bufferRef.current += e.key
          setBuffer(bufferRef.current)
        } else {
          // Slow typing = reset
          bufferRef.current = e.key
          setBuffer(e.key)
        }

        clearTimeout(timeout)
        timeout = setTimeout(() => {
          if (bufferRef.current.length >= 8) {
            // Auto-submit if looks like a barcode (8+ chars, rapid input)
            onScan(bufferRef.current)
          }
          bufferRef.current = ''
          setBuffer('')
        }, 200)
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(timeout)
    }
  }, [onScan])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manual.trim()) {
      onScan(manual.trim())
      setManual('')
    }
  }

  return (
    <form onSubmit={handleManualSubmit} className="relative">
      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
      <input
        data-barcode-input="true"
        type="text"
        className="input pl-9 text-sm w-full"
        placeholder={placeholder}
        value={manual}
        onChange={e => setManual(e.target.value)}
      />
      {buffer && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-500 font-mono animate-pulse">
          Scanning: {buffer}
        </div>
      )}
    </form>
  )
}
