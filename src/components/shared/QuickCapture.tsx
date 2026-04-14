'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Mic, Plus, X, FileText, Square } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getActiveWorkspace } from '@/lib/get-active-workspace'
import { cn } from '@/lib/utils'

type Mode = 'closed' | 'menu' | 'voice' | 'note'

const NOTES_BUCKET = 'notes'
const EXPENSES_BUCKET = 'expenses'

async function uploadOrFallback(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  blob: Blob,
): Promise<{ url: string | null; base64?: string }> {
  // TODO: ensure Supabase Storage buckets `notes` and `expenses` exist
  // and have appropriate RLS policies. Falls back to base64 in DB if missing.
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (err) {
    console.warn('[quick-capture] storage upload failed, falling back to base64', err)
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    return { url: null, base64 }
  }
}

export default function QuickCapture() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('closed')
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteText, setNoteText] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('closed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function ensureWorkspace() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const ws = await getActiveWorkspace(supabase, user.id, 'id')
    if (!ws?.id) throw new Error('No workspace')
    return { user, workspaceId: ws.id as string }
  }

  // ---------- Voice note ----------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        await saveVoiceNote()
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (err) {
      console.warn('[quick-capture] mic permission failed', err)
      toast.error('Microphone blocked. Enable mic access in browser settings.')
      setMode('closed')
    }
  }

  async function stopRecording() {
    const mr = mediaRecorderRef.current
    if (!mr) return
    setBusy(true)
    mr.stop()
    setRecording(false)
  }

  async function saveVoiceNote() {
    try {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const { user, workspaceId } = await ensureWorkspace()
      const path = `${workspaceId}/${user.id}/${Date.now()}.webm`
      const { url, base64 } = await uploadOrFallback(supabase, NOTES_BUCKET, path, blob)

      const content = url
        ? `[Audio note] ${url}`
        : `[Audio note] (inline) ${base64?.slice(0, 80)}...`

      const { error } = await supabase.from('notes').insert({
        workspace_id: workspaceId,
        author_id: user.id,
        title: 'Voice note',
        content,
        tags: ['voice', 'mobile'],
      })
      if (error) throw error
      toast.success('Voice note saved')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save voice note')
    } finally {
      setBusy(false)
      setMode('closed')
    }
  }

  // ---------- Receipt photo ----------
  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const { user, workspaceId } = await ensureWorkspace()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${workspaceId}/${user.id}/${Date.now()}.${ext}`
      const { url, base64 } = await uploadOrFallback(supabase, EXPENSES_BUCKET, path, file)

      // TODO: dedicated `expenses` table. For now we store the receipt as a
      // tagged note since `expenses` table is not in schema yet.
      const content = url
        ? `[Receipt photo] ${url}\n\nPhoto expense — fill details (amount, vendor, category)`
        : `[Receipt photo] (inline)\n${base64?.slice(0, 120)}...\n\nPhoto expense — fill details`

      const { data, error } = await supabase
        .from('notes')
        .insert({
          workspace_id: workspaceId,
          author_id: user.id,
          title: 'Photo expense — fill details',
          content,
          tags: ['expense', 'mobile'],
        })
        .select('id')
        .single()
      if (error) throw error
      toast.success('Receipt captured')
      setMode('closed')
      if (data?.id) router.push(`/notes/${data.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to save receipt')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ---------- Quick note ----------
  async function saveQuickNote() {
    if (!noteText.trim()) {
      setMode('closed')
      return
    }
    setBusy(true)
    try {
      const { user, workspaceId } = await ensureWorkspace()
      const { error } = await supabase.from('notes').insert({
        workspace_id: workspaceId,
        author_id: user.id,
        title: 'Quick note',
        content: noteText.trim(),
        tags: ['quick', 'mobile'],
      })
      if (error) throw error
      toast.success('Note saved')
      setNoteText('')
      setMode('closed')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save note')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="md:hidden">
      {/* Hidden file input for receipt */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      {/* FAB */}
      {mode === 'closed' && (
        <button
          type="button"
          aria-label="Quick capture"
          onClick={() => setMode('menu')}
          className="fixed right-4 bottom-20 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:scale-95 transition"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Backdrop + sheet */}
      {mode !== 'closed' && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => !busy && !recording && setMode('closed')}
        >
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 pb-6 shadow-2xl dark:bg-surface-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-surface-200 dark:bg-surface-700" />

            {mode === 'menu' && (
              <div className="space-y-2">
                <h3 className="px-2 pb-2 text-sm font-semibold text-surface-900 dark:text-surface-50">
                  Quick capture
                </h3>
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-4 text-left active:scale-[0.98] dark:border-surface-700 dark:bg-surface-800"
                  onClick={() => {
                    setMode('voice')
                    startRecording()
                  }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20">
                    <Mic className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-50">Voice note</span>
                    <span className="block text-xs text-surface-500">Record audio memo</span>
                  </span>
                </button>

                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-4 text-left active:scale-[0.98] dark:border-surface-700 dark:bg-surface-800"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20">
                    <Camera className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-50">Receipt photo</span>
                    <span className="block text-xs text-surface-500">Snap to log expense</span>
                  </span>
                </button>

                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-4 text-left active:scale-[0.98] dark:border-surface-700 dark:bg-surface-800"
                  onClick={() => setMode('note')}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-surface-900 dark:text-surface-50">Quick note</span>
                    <span className="block text-xs text-surface-500">Type a fast note</span>
                  </span>
                </button>

                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-surface-500 hover:text-surface-700"
                  onClick={() => setMode('closed')}
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            )}

            {mode === 'voice' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div
                  className={cn(
                    'flex h-24 w-24 items-center justify-center rounded-full',
                    recording
                      ? 'bg-rose-100 text-rose-600 animate-pulse dark:bg-rose-500/20'
                      : 'bg-surface-100 text-surface-400 dark:bg-surface-800',
                  )}
                >
                  <Mic className="h-10 w-10" />
                </div>
                <p className="text-sm font-medium text-surface-900 dark:text-surface-50">
                  {busy ? 'Saving…' : recording ? 'Recording…' : 'Preparing mic…'}
                </p>
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex items-center gap-2"
                    disabled={!recording || busy}
                    onClick={stopRecording}
                  >
                    <Square className="h-4 w-4" /> Stop & save
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      try {
                        mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
                      } catch {}
                      mediaRecorderRef.current = null
                      setRecording(false)
                      setMode('closed')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === 'note' && (
              <div className="space-y-3">
                <h3 className="px-1 text-sm font-semibold text-surface-900 dark:text-surface-50">Quick note</h3>
                <textarea
                  autoFocus
                  className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700 dark:bg-surface-800"
                  rows={4}
                  placeholder="Write something…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" disabled={busy} onClick={() => setMode('closed')}>
                    Cancel
                  </button>
                  <button className="btn-primary" disabled={busy || !noteText.trim()} onClick={saveQuickNote}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
