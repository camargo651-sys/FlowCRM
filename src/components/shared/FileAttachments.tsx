'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, Trash2, FileText, Image, File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileAttachmentsProps {
  entityType: string // 'contact' | 'deal' | 'invoice' | 'quote' | 'product'
  entityId: string
  workspaceId: string
}

interface Attachment {
  id: string
  file_name: string
  file_url: string
  file_size: number
  mime_type: string
  created_at: string
}

function getIcon(mime: string) {
  if (mime?.startsWith('image/')) return Image
  return FileText
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FileAttachments({ entityType, entityId, workspaceId }: FileAttachmentsProps) {
  const supabase = createClient()
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('attachments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    setAttachments(data || [])
  }

  useEffect(() => { load() }, [entityId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.size > 10 * 1024 * 1024) return // 10MB limit
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${workspaceId}/${entityType}/${entityId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('attachments').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path)

      await supabase.from('attachments').insert({
        workspace_id: workspaceId,
        entity_type: entityType,
        entity_id: entityId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
      })
      load()
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleDelete = async (id: string) => {
    await supabase.from('attachments').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-surface-500 uppercase flex items-center gap-1.5">
          <Paperclip className="w-3 h-3" /> Files ({attachments.length})
        </h4>
        <label className={cn('text-xs text-brand-600 font-semibold cursor-pointer hover:underline flex items-center gap-1', uploading && 'opacity-50')}>
          <Upload className="w-3 h-3" /> Upload
          <input type="file" className="sr-only" disabled={uploading} onChange={handleUpload} />
        </label>
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const Icon = getIcon(att.mime_type)
            return (
              <div key={att.id} className="flex items-center gap-2 p-2 bg-surface-50 rounded-lg group">
                <Icon className="w-4 h-4 text-surface-400 flex-shrink-0" />
                <a href={att.file_url} target="_blank" className="text-xs text-brand-600 hover:underline truncate flex-1">
                  {att.file_name}
                </a>
                <span className="text-[10px] text-surface-300">{formatSize(att.file_size)}</span>
                <button onClick={() => handleDelete(att.id)}
                  className="text-surface-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] text-surface-300 text-center py-2">No files attached</p>
      )}
    </div>
  )
}
