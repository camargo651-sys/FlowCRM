'use client'
import { useState } from 'react'
import {
  Type, Heading1, Image as ImageIcon, MousePointerClick,
  Minus, Video, ArrowUpDown, Plus, Trash2, ArrowUp, ArrowDown, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type Block, type BlockType, makeBlock,
  EMAIL_BLOCK_TYPES, WHATSAPP_BLOCK_TYPES,
} from '@/lib/campaigns/blocks-to-html'

interface Props {
  value: Block[]
  onChange: (blocks: Block[]) => void
  type: 'email' | 'whatsapp'
}

const BLOCK_META: Record<BlockType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  heading: { label: 'Heading', icon: Heading1 },
  text:    { label: 'Text',    icon: Type },
  image:   { label: 'Image',   icon: ImageIcon },
  button:  { label: 'Button',  icon: MousePointerClick },
  divider: { label: 'Divider', icon: Minus },
  video:   { label: 'Video',   icon: Video },
  spacer:  { label: 'Spacer',  icon: ArrowUpDown },
}

export default function VisualMessageEditor({ value, onChange, type }: Props) {
  const [pickerOpenAt, setPickerOpenAt] = useState<number | null>(null)
  const allowed = type === 'whatsapp' ? WHATSAPP_BLOCK_TYPES : EMAIL_BLOCK_TYPES

  const update = (id: string, patch: Partial<Block>) => {
    onChange(value.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  const updateMeta = (id: string, meta: Record<string, unknown>) => {
    onChange(value.map(b => b.id === id ? { ...b, meta: { ...b.meta, ...meta } } : b))
  }
  const remove = (id: string) => onChange(value.filter(b => b.id !== id))
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }
  const insertAt = (idx: number, blockType: BlockType) => {
    const next = [...value]
    next.splice(idx, 0, makeBlock(blockType))
    onChange(next)
    setPickerOpenAt(null)
  }

  const AddButton = ({ index }: { index: number }) => (
    <div className="relative flex items-center justify-center my-1">
      {pickerOpenAt === index ? (
        <div className="w-full rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Add block</p>
            <button onClick={() => setPickerOpenAt(null)} className="text-surface-400 hover:text-surface-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {allowed.map(bt => {
              const { label, icon: Icon } = BLOCK_META[bt]
              return (
                <button key={bt} onClick={() => insertAt(index, bt)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border border-surface-100 bg-white hover:border-brand-300 hover:bg-brand-50 transition">
                  <Icon className="w-4 h-4 text-surface-500" />
                  <span className="text-[11px] text-surface-600">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <button onClick={() => setPickerOpenAt(index)}
          className="group flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-surface-200 text-[11px] text-surface-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition">
          <Plus className="w-3 h-3" />
          Add block
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-1">
      <AddButton index={0} />
      {value.map((block, idx) => {
        const { icon: Icon, label } = BLOCK_META[block.type]
        return (
          <div key={block.id}>
            <div className="group rounded-xl border border-surface-100 bg-white p-3 hover:border-surface-200 transition">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-surface-400 uppercase tracking-wider">
                  <Icon className="w-3 h-3" />
                  {label}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="p-1 rounded hover:bg-surface-50 text-surface-400 disabled:opacity-30" title="Move up">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === value.length - 1}
                    className="p-1 rounded hover:bg-surface-50 text-surface-400 disabled:opacity-30" title="Move down">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button onClick={() => remove(block.id)}
                    className="p-1 rounded hover:bg-red-50 text-surface-400 hover:text-red-500" title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {block.type === 'heading' && (
                <input className="input text-lg font-bold" value={block.content}
                  onChange={e => update(block.id, { content: e.target.value })}
                  placeholder="Your headline" />
              )}

              {block.type === 'text' && (
                <textarea className="input resize-none" rows={4} value={block.content}
                  onChange={e => update(block.id, { content: e.target.value })}
                  placeholder="Write your message here..." />
              )}

              {block.type === 'image' && (
                <div className="space-y-2">
                  <input className="input text-xs" placeholder="Image URL (https://...)"
                    value={String(block.meta?.url || '')}
                    onChange={e => updateMeta(block.id, { url: e.target.value })} />
                  <input className="input text-xs" placeholder="Alt text (optional)"
                    value={String(block.meta?.alt || '')}
                    onChange={e => updateMeta(block.id, { alt: e.target.value })} />
                  {block.meta?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={String(block.meta.url)} alt={String(block.meta.alt || '')}
                      className="max-h-40 rounded-lg border border-surface-100" />
                  ) : (
                    <div className="h-20 rounded-lg border border-dashed border-surface-200 flex items-center justify-center text-[11px] text-surface-400">
                      Paste an image URL to preview
                    </div>
                  )}
                </div>
              )}

              {block.type === 'button' && (
                <div className="space-y-2">
                  <input className="input text-xs" placeholder="Button label"
                    value={block.content}
                    onChange={e => update(block.id, { content: e.target.value })} />
                  <input className="input text-xs" placeholder="Link URL (https://...)"
                    value={String(block.meta?.url || '')}
                    onChange={e => updateMeta(block.id, { url: e.target.value })} />
                </div>
              )}

              {block.type === 'video' && (
                <input className="input text-xs" placeholder="Video URL (YouTube, Vimeo, etc.)"
                  value={String(block.meta?.url || '')}
                  onChange={e => updateMeta(block.id, { url: e.target.value })} />
              )}

              {block.type === 'divider' && (
                <div className="py-2"><hr className="border-surface-200" /></div>
              )}

              {block.type === 'spacer' && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-surface-500">Height</span>
                  <input type="range" min={8} max={96} step={4}
                    value={Number(block.meta?.size ?? 24)}
                    onChange={e => updateMeta(block.id, { size: Number(e.target.value) })}
                    className="flex-1" />
                  <span className="text-[11px] text-surface-400 w-10 text-right">{Number(block.meta?.size ?? 24)}px</span>
                </div>
              )}
            </div>
            <AddButton index={idx + 1} />
          </div>
        )
      })}

      {value.length === 0 && pickerOpenAt !== 0 && (
        <div className="text-center py-10 text-xs text-surface-400">
          No blocks yet. Click <span className="font-semibold">Add block</span> to start.
        </div>
      )}
    </div>
  )
}

/** Lightweight preview renderers, exported so pages can show live previews. */
export function EmailPreview({ html }: { html: string }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-surface-50 p-4">
      <div className="mx-auto bg-white rounded-lg shadow-sm" style={{ maxWidth: 600 }}>
        <div className={cn('min-h-[300px]')} dangerouslySetInnerHTML={{ __html: html || '<p style="padding:40px;text-align:center;color:#9ca3af;font-family:sans-serif;">Your email preview will appear here</p>' }} />
      </div>
    </div>
  )
}

export function WhatsAppPreview({ text }: { text: string }) {
  return (
    <div className="bg-[#e5ddd5] rounded-xl p-4">
      <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-xs">
        <p className="text-sm text-surface-800 whitespace-pre-wrap break-words">
          {text || 'Your message will appear here...'}
        </p>
        <p className="text-[10px] text-surface-400 text-right mt-1">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
