'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Copy, Check, Save, Eye, MessageCircle, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace-context'
import { useI18n } from '@/lib/i18n/context'
import { getActiveWorkspace } from '@/lib/get-active-workspace'

interface WidgetConfig {
  greeting: string
  button_text: string
  color: string
  auto_whatsapp_reply: boolean
  auto_reply_message: string
}

const DEFAULT_CONFIG: WidgetConfig = {
  greeting: 'Hi! How can we help you?',
  button_text: 'Chat with us',
  color: '#0891B2',
  auto_whatsapp_reply: true,
  auto_reply_message: "Hi {name}! Thanks for reaching out via our website. We'll be in touch shortly.",
}

export default function WidgetSettingsPage() {
  const supabase = createClient()
  const { primaryColor } = useWorkspace()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [workspaceId, setWorkspaceId] = useState('')
  const [config, setConfig] = useState<WidgetConfig>({ ...DEFAULT_CONFIG, color: primaryColor || '#0891B2' })
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const ws = await getActiveWorkspace(supabase, user.id, 'id, widget_config, primary_color')
    if (!ws) { setLoading(false); return }
    setWorkspaceId(ws.id)
    if (ws.widget_config) {
      const wc = ws.widget_config as Partial<WidgetConfig>
      setConfig({
        greeting: wc.greeting || DEFAULT_CONFIG.greeting,
        button_text: wc.button_text || DEFAULT_CONFIG.button_text,
        color: wc.color || ws.primary_color || DEFAULT_CONFIG.color,
        auto_whatsapp_reply: wc.auto_whatsapp_reply !== false,
        auto_reply_message: wc.auto_reply_message || DEFAULT_CONFIG.auto_reply_message,
      })
    } else if (ws.primary_color) {
      setConfig(prev => ({ ...prev, color: ws.primary_color }))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async () => {
    setSaving(true)
    const { error } = await supabase.from('workspaces').update({ widget_config: config as unknown as Record<string, unknown> }).eq('id', workspaceId)
    if (error) {
      toast.error('Failed to save widget settings')
    } else {
      toast.success('Widget settings saved')
    }
    setSaving(false)
  }

  const embedCode = `<script src="https://tracktio.app/widget.js" data-workspace="${workspaceId}" data-color="${config.color}" data-greeting="${config.greeting}" data-button-text="${config.button_text}"></script>`

  const copyCode = async () => {
    await navigator.clipboard.writeText(embedCode)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Globe className="w-6 h-6 text-brand-600" />
          {t('nav.widget')}
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          Embed a chat widget on your website to capture leads and connect them to WhatsApp.
        </p>
      </div>

      {/* Embed Code */}
      <section className="bg-white border border-surface-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">Embed Code</h2>
        <p className="text-sm text-surface-500">
          Copy and paste this code before the closing <code className="bg-surface-100 px-1 rounded">&lt;/body&gt;</code> tag on your website.
        </p>
        <div className="relative">
          <pre className="bg-surface-50 border border-surface-200 rounded-lg p-4 text-xs text-surface-700 overflow-x-auto whitespace-pre-wrap break-all font-mono">
            {embedCode}
          </pre>
          <button
            onClick={copyCode}
            className="absolute top-3 right-3 p-2 rounded-lg bg-white border border-surface-200 hover:bg-surface-50 transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-surface-500" />}
          </button>
        </div>
      </section>

      {/* Configuration */}
      <section className="bg-white border border-surface-200 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-surface-900">Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Greeting */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">Greeting message</label>
            <input
              type="text"
              value={config.greeting}
              onChange={e => setConfig(prev => ({ ...prev, greeting: e.target.value }))}
              className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              maxLength={200}
            />
          </div>

          {/* Button text */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">Button text</label>
            <input
              type="text"
              value={config.button_text}
              onChange={e => setConfig(prev => ({ ...prev, button_text: e.target.value }))}
              className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              maxLength={50}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-surface-700">Widget color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.color}
                onChange={e => setConfig(prev => ({ ...prev, color: e.target.value }))}
                className="w-10 h-10 rounded-lg border border-surface-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={config.color}
                onChange={e => setConfig(prev => ({ ...prev, color: e.target.value }))}
                className="w-28 px-3 py-2.5 border border-surface-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* WhatsApp Auto-Reply */}
        <div className="border-t border-surface-100 pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-surface-700">Auto-reply via WhatsApp</span>
            </div>
            <button
              onClick={() => setConfig(prev => ({ ...prev, auto_whatsapp_reply: !prev.auto_whatsapp_reply }))}
              className={cn(
                'relative w-10 h-6 rounded-full transition-colors',
                config.auto_whatsapp_reply ? 'bg-green-500' : 'bg-surface-300'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                config.auto_whatsapp_reply ? 'translate-x-[18px]' : 'translate-x-0.5'
              )} />
            </button>
          </div>

          {config.auto_whatsapp_reply && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-surface-700">
                Auto-reply message <span className="text-surface-400 font-normal">(use {'{name}'} for personalization)</span>
              </label>
              <textarea
                value={config.auto_reply_message}
                onChange={e => setConfig(prev => ({ ...prev, auto_reply_message: e.target.value }))}
                className="w-full px-3 py-2.5 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                rows={3}
                maxLength={500}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save settings'}
          </button>
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-surface-200 text-surface-700 rounded-lg text-sm font-medium hover:bg-surface-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {previewOpen ? 'Hide preview' : 'Preview widget'}
          </button>
        </div>
      </section>

      {/* Preview */}
      {previewOpen && (
        <section className="bg-white border border-surface-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-surface-900">Preview</h2>
          <div className="relative bg-surface-50 rounded-xl border border-surface-200 min-h-[560px] overflow-hidden">
            {/* Simulated widget preview */}
            <div className="absolute bottom-5 right-5 flex flex-col items-end gap-3">
              {/* Chat window preview */}
              <div className="w-[350px] bg-white rounded-2xl shadow-xl overflow-hidden border border-surface-100">
                <div className="px-5 py-4 text-white font-semibold text-[15px] flex items-center justify-between"
                  style={{ backgroundColor: config.color }}>
                  <span>{config.button_text}</span>
                  <span className="opacity-60 text-lg cursor-default">&times;</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="bg-surface-100 px-4 py-3 rounded-xl rounded-bl text-sm text-surface-700 max-w-[80%]">
                    {config.greeting}
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-10 bg-surface-50 border border-surface-200 rounded-lg flex items-center px-3 text-xs text-surface-400">Your name</div>
                    <div className="h-10 bg-surface-50 border border-surface-200 rounded-lg flex items-center px-3 text-xs text-surface-400">WhatsApp / Phone number</div>
                    <div className="h-16 bg-surface-50 border border-surface-200 rounded-lg flex items-start p-3 text-xs text-surface-400">How can we help?</div>
                    <div className="h-10 rounded-lg text-white text-sm font-semibold flex items-center justify-center"
                      style={{ backgroundColor: config.color }}>
                      Send message
                    </div>
                  </div>
                </div>
              </div>
              {/* Button preview */}
              <div className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: config.color }}>
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
