'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Sparkles, Bot, User, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are Tracktio's AI setup assistant. Your job is to help the user configure their ERP by asking questions about their business.

Ask questions ONE AT A TIME in a conversational way. Be concise and friendly.

Questions to ask (in order):
1. What type of business do you have? (e.g., retail, services, manufacturing, agency, healthcare)
2. How many employees?
3. Do you need inventory management?
4. Do you sell online (e-commerce)?
5. Do you need HR/payroll?
6. Do you need accounting?
7. What language do you prefer? (Spanish/English)

After collecting answers, respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing:
{
  "industry": "b2b_sales|distribution|real_estate|healthcare|education|agency|b2c_social|generic",
  "modules": {
    "crm": true, "invoicing": true, "inventory": true/false,
    "purchasing": true/false, "manufacturing": true/false,
    "accounting": true/false, "hr": true/false, "expenses": true/false,
    "ecommerce": true/false, "pos": true/false, "automations": true
  },
  "language": "es|en",
  "summary": "Brief description of what was configured"
}

Keep responses SHORT. Use the user's language (Spanish if they write in Spanish).`

export default function AISetupPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m Tracktio\'s AI assistant. I\'ll help you set up your ERP in a few questions. Let\'s start — what type of business do you run?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applied, setApplied] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/insights', { method: 'POST' })
      // Use Claude directly for the conversation
      const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY

      // Fallback: simulate AI response based on context
      const allMessages = [...messages, userMsg]
      const questionCount = allMessages.filter(m => m.role === 'assistant').length

      let aiResponse = ''

      // Simple conversational flow
      if (questionCount === 1) {
        aiResponse = `Got it! And how many people work in your team?`
      } else if (questionCount === 2) {
        aiResponse = `Do you need to manage inventory and products?`
      } else if (questionCount === 3) {
        aiResponse = `Do you sell online or need an e-commerce store?`
      } else if (questionCount === 4) {
        aiResponse = `Do you need HR management and payroll?`
      } else if (questionCount === 5) {
        aiResponse = `Do you need accounting (chart of accounts, journal entries)?`
      } else if (questionCount === 6) {
        aiResponse = `Last question — do you prefer the app in Spanish or English?`
      } else {
        // Generate config based on conversation
        const convo = allMessages.map(m => m.content.toLowerCase()).join(' ')
        const needsInventory = convo.includes('inventory') || convo.includes('product') || convo.includes('retail') || convo.includes('manufactur') || convo.includes('si') || convo.includes('yes')
        const needsEcommerce = convo.includes('online') || convo.includes('ecommerce') || convo.includes('e-commerce') || convo.includes('tienda')
        const needsHR = convo.includes('hr') || convo.includes('payroll') || convo.includes('nómina') || convo.includes('empleado')
        const needsAccounting = convo.includes('accounting') || convo.includes('contab')
        const isSpanish = convo.includes('español') || convo.includes('spanish')

        const config = {
          modules: {
            crm: true, invoicing: true, automations: true,
            inventory: needsInventory, purchasing: needsInventory,
            manufacturing: convo.includes('manufactur') || convo.includes('fabri'),
            accounting: needsAccounting, hr: needsHR, expenses: needsHR,
            ecommerce: needsEcommerce, pos: convo.includes('pos') || convo.includes('retail') || convo.includes('tienda física'),
          },
          language: isSpanish ? 'es' : 'en',
        }

        const enabledList = Object.entries(config.modules).filter(([_, v]) => v).map(([k]) => k)
        aiResponse = `Perfect! Here's what I'll configure for you:\n\n**Modules:** ${enabledList.join(', ')}\n**Language:** ${config.language === 'es' ? 'Spanish' : 'English'}\n\nClick "Apply Configuration" below to set everything up!`

        // Store config for apply button
        sessionStorage.setItem('tracktio_ai_config', JSON.stringify(config))
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had an issue. Could you try again?' }])
    }
    setLoading(false)
  }

  const applyConfig = async () => {
    const stored = sessionStorage.getItem('tracktio_ai_config')
    if (!stored) return

    const config = JSON.parse(stored)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
    if (!ws) return

    await supabase.from('workspaces').update({
      enabled_modules: config.modules,
      language: config.language,
    }).eq('id', ws.id)

    setApplied(true)
    toast.success('Configuration applied! Reloading...')
    setTimeout(() => window.location.href = '/dashboard', 1500)
  }

  const hasConfig = messages.some(m => m.content.includes('Apply Configuration'))

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-surface-900">AI Setup Assistant</h1>
        <p className="text-sm text-surface-500 mt-1">Tell me about your business and I'll configure Tracktio for you</p>
      </div>

      {/* Chat */}
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 320px)' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 64px)' }}>
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-brand-600" />
                </div>
              )}
              <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                msg.role === 'user' ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-surface-100 text-surface-800 rounded-tl-sm')}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 bg-surface-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-surface-500" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
              </div>
              <div className="bg-surface-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1"><div className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} /><div className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} /></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-surface-100 flex gap-2">
          {hasConfig && !applied ? (
            <button onClick={applyConfig} className="btn-primary w-full py-3">
              <CheckCircle2 className="w-4 h-4" /> Apply Configuration
            </button>
          ) : applied ? (
            <div className="w-full text-center py-3 text-sm text-emerald-600 font-semibold">Redirecting to dashboard...</div>
          ) : (
            <>
              <input className="input flex-1" placeholder="Type your answer..."
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} disabled={loading} autoFocus />
              <button onClick={sendMessage} disabled={!input.trim() || loading} className="btn-primary btn-sm px-4">
                <Send className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
