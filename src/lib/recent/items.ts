'use client'

export type RecentItemType = 'contact' | 'deal' | 'invoice' | 'ticket' | 'lead' | 'quote'

export interface RecentItem {
  type: RecentItemType
  id: string
  label: string
  href: string
  ts: number
}

const STORAGE_KEY = 'tracktio_recent_items'
const MAX = 10

function read(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function write(items: RecentItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('tracktio:recent-updated'))
  } catch {
    /* ignore */
  }
}

export function pushRecent(item: Omit<RecentItem, 'ts'>) {
  if (!item.id || !item.label) return
  const existing = read().filter(i => !(i.type === item.type && i.id === item.id))
  const next: RecentItem[] = [{ ...item, ts: Date.now() }, ...existing].slice(0, MAX)
  write(next)
}

export function getRecent(): RecentItem[] {
  return read()
}

export function clearRecent() {
  write([])
}
