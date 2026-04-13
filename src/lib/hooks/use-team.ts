'use client'
import { useEffect, useState } from 'react'

export interface TeamUser {
  id: string
  name: string
  email?: string
}

export function useTeam() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/team')
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) setUsers(data.users || [])
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { users, loading }
}
