/**
 * Provider Registry — Extension architecture for Tracktio
 *
 * Each service category (email, payments, signatures, etc.) has multiple
 * provider adapters. Workspaces choose which provider to use and store
 * their own API keys.
 *
 * Usage:
 *   const emailProvider = getProvider('email', workspace.providers)
 *   await emailProvider.send({ to, subject, html })
 */

// ── SERVICE CATEGORIES ──

export type ServiceCategory =
  | 'email'       // Transactional + marketing emails
  | 'payments'    // Payment processing
  | 'signatures'  // Document e-signing
  | 'whatsapp'    // WhatsApp messaging
  | 'sms'         // SMS messaging
  | 'ai'          // AI/LLM provider
  | 'storage'     // File storage
  | 'calendar'    // Calendar sync

// ── PROVIDER DEFINITIONS ──

export interface ProviderDef {
  key: string
  name: string
  category: ServiceCategory
  description: string
  logo: string        // emoji or URL
  website: string
  requiredKeys: { key: string; label: string; placeholder: string; secret?: boolean }[]
  freeTier?: string   // e.g. "100 emails/day"
}

export const PROVIDERS: ProviderDef[] = [
  // ── EMAIL ──
  {
    key: 'resend', name: 'Resend', category: 'email',
    description: 'Modern email API. Best developer experience.',
    logo: '📧', website: 'https://resend.com',
    requiredKeys: [
      { key: 'api_key', label: 'API Key', placeholder: 're_xxxx...', secret: true },
      { key: 'from_email', label: 'From Email', placeholder: 'noreply@yourdomain.com' },
    ],
    freeTier: '100 emails/day',
  },
  {
    key: 'sendgrid', name: 'SendGrid', category: 'email',
    description: 'Enterprise email delivery by Twilio.',
    logo: '📨', website: 'https://sendgrid.com',
    requiredKeys: [
      { key: 'api_key', label: 'API Key', placeholder: 'SG.xxxx...', secret: true },
      { key: 'from_email', label: 'From Email', placeholder: 'noreply@yourdomain.com' },
    ],
    freeTier: '100 emails/day',
  },
  {
    key: 'smtp', name: 'Custom SMTP', category: 'email',
    description: 'Any SMTP server (Gmail, Outlook, your own).',
    logo: '🔧', website: '',
    requiredKeys: [
      { key: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', placeholder: '587' },
      { key: 'username', label: 'Username', placeholder: 'you@gmail.com' },
      { key: 'password', label: 'Password', placeholder: 'App password', secret: true },
      { key: 'from_email', label: 'From Email', placeholder: 'you@gmail.com' },
    ],
  },

  // ── PAYMENTS ──
  {
    key: 'stripe', name: 'Stripe', category: 'payments',
    description: 'Global payment processing. Cards, wallets, bank transfers.',
    logo: '💳', website: 'https://stripe.com',
    requiredKeys: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_xxxx...', secret: true },
      { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_xxxx...' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_xxxx...', secret: true },
    ],
  },
  {
    key: 'mercadopago', name: 'MercadoPago', category: 'payments',
    description: 'Payment leader in Latin America. Cards, Pix, cash.',
    logo: '🟦', website: 'https://mercadopago.com',
    requiredKeys: [
      { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-xxxx...', secret: true },
      { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-xxxx...' },
    ],
  },
  {
    key: 'paypal', name: 'PayPal', category: 'payments',
    description: 'Global payments. PayPal, Venmo, credit cards.',
    logo: '🅿️', website: 'https://paypal.com',
    requiredKeys: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxx...', secret: true },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxx...', secret: true },
    ],
  },

  // ── SIGNATURES ──
  {
    key: 'builtin_sign', name: 'Built-in Signature', category: 'signatures',
    description: 'Free canvas-based signature pad. No external service needed.',
    logo: '✍️', website: '',
    requiredKeys: [],
    freeTier: 'Unlimited, free',
  },
  {
    key: 'docusign', name: 'DocuSign', category: 'signatures',
    description: 'Industry-standard e-signature platform.',
    logo: '📝', website: 'https://docusign.com',
    requiredKeys: [
      { key: 'integration_key', label: 'Integration Key', placeholder: 'xxxx-xxxx...', secret: true },
      { key: 'account_id', label: 'Account ID', placeholder: 'xxxx...' },
    ],
  },

  // ── WHATSAPP ──
  {
    key: 'meta_whatsapp', name: 'Meta WhatsApp Business', category: 'whatsapp',
    description: 'Official WhatsApp Business API via Meta.',
    logo: '💬', website: 'https://business.whatsapp.com',
    requiredKeys: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '123456...' },
      { key: 'access_token', label: 'Access Token', placeholder: 'EAAxxxx...', secret: true },
      { key: 'app_secret', label: 'App Secret', placeholder: 'xxxx...', secret: true },
    ],
  },
  {
    key: 'twilio_whatsapp', name: 'Twilio WhatsApp', category: 'whatsapp',
    description: 'WhatsApp via Twilio. Easy setup, pay-as-you-go.',
    logo: '🔴', website: 'https://twilio.com',
    requiredKeys: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxx...' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'xxxx...', secret: true },
      { key: 'from_number', label: 'WhatsApp Number', placeholder: 'whatsapp:+14155...' },
    ],
  },

  // ── SMS ──
  {
    key: 'twilio_sms', name: 'Twilio SMS', category: 'sms',
    description: 'Global SMS delivery.',
    logo: '📱', website: 'https://twilio.com',
    requiredKeys: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxx...' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'xxxx...', secret: true },
      { key: 'from_number', label: 'From Number', placeholder: '+14155...' },
    ],
  },

  // ── AI ──
  {
    key: 'anthropic', name: 'Anthropic (Claude)', category: 'ai',
    description: 'Claude AI for insights, scoring, and automation.',
    logo: '🧠', website: 'https://anthropic.com',
    requiredKeys: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-ant-xxxx...', secret: true },
    ],
  },
  {
    key: 'openai', name: 'OpenAI (GPT)', category: 'ai',
    description: 'GPT models for AI features.',
    logo: '🤖', website: 'https://openai.com',
    requiredKeys: [
      { key: 'api_key', label: 'API Key', placeholder: 'sk-xxxx...', secret: true },
    ],
  },

  // ── STORAGE ──
  {
    key: 'supabase_storage', name: 'Supabase Storage', category: 'storage',
    description: 'Built-in storage. No configuration needed.',
    logo: '🗄️', website: '',
    requiredKeys: [],
    freeTier: 'Included with Tracktio',
  },
  {
    key: 'aws_s3', name: 'Amazon S3', category: 'storage',
    description: 'Scalable cloud storage by AWS.',
    logo: '☁️', website: 'https://aws.amazon.com/s3',
    requiredKeys: [
      { key: 'access_key', label: 'Access Key ID', placeholder: 'AKIAxxxx...', secret: true },
      { key: 'secret_key', label: 'Secret Access Key', placeholder: 'xxxx...', secret: true },
      { key: 'bucket', label: 'Bucket Name', placeholder: 'my-tracktio-files' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    ],
  },

  // ── CALENDAR ──
  {
    key: 'google_calendar', name: 'Google Calendar', category: 'calendar',
    description: 'Sync tasks and meetings with Google Calendar.',
    logo: '📅', website: 'https://calendar.google.com',
    requiredKeys: [
      { key: 'client_id', label: 'OAuth Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
      { key: 'client_secret', label: 'OAuth Client Secret', placeholder: 'GOCSPXxxxx...', secret: true },
    ],
  },
  {
    key: 'outlook_calendar', name: 'Outlook Calendar', category: 'calendar',
    description: 'Sync with Microsoft Outlook / Office 365.',
    logo: '📆', website: 'https://outlook.com',
    requiredKeys: [
      { key: 'client_id', label: 'App Client ID', placeholder: 'xxxx-xxxx...' },
      { key: 'client_secret', label: 'App Client Secret', placeholder: 'xxxx...', secret: true },
    ],
  },
]

// ── HELPERS ──

export function getProvidersByCategory(category: ServiceCategory): ProviderDef[] {
  return PROVIDERS.filter(p => p.category === category)
}

export function getProviderDef(key: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.key === key)
}

export function getCategories(): { key: ServiceCategory; label: string; icon: string; description: string }[] {
  return [
    { key: 'email', label: 'Email', icon: '📧', description: 'Send transactional emails and marketing campaigns' },
    { key: 'payments', label: 'Payments', icon: '💳', description: 'Accept payments from customers' },
    { key: 'signatures', label: 'E-Signatures', icon: '✍️', description: 'Sign contracts and documents digitally' },
    { key: 'whatsapp', label: 'WhatsApp', icon: '💬', description: 'Send and receive WhatsApp messages' },
    { key: 'sms', label: 'SMS', icon: '📱', description: 'Send text messages to contacts' },
    { key: 'ai', label: 'AI / LLM', icon: '🧠', description: 'AI-powered insights and automation' },
    { key: 'storage', label: 'Storage', icon: '🗄️', description: 'File and document storage' },
    { key: 'calendar', label: 'Calendar', icon: '📅', description: 'Sync events and meetings' },
  ]
}

// ── WORKSPACE PROVIDER CONFIG ──

export interface WorkspaceProvider {
  category: ServiceCategory
  provider_key: string
  config: Record<string, string>  // API keys and settings
  enabled: boolean
}

/**
 * Get the active provider for a category from workspace config.
 * Falls back to built-in/free providers when available.
 */
export function getActiveProvider(
  category: ServiceCategory,
  workspaceProviders: WorkspaceProvider[]
): WorkspaceProvider | null {
  const active = workspaceProviders.find(p => p.category === category && p.enabled)
  if (active) return active

  // Fallbacks for categories with free built-in options
  const fallbacks: Partial<Record<ServiceCategory, string>> = {
    signatures: 'builtin_sign',
    storage: 'supabase_storage',
  }

  if (fallbacks[category]) {
    return {
      category,
      provider_key: fallbacks[category]!,
      config: {},
      enabled: true,
    }
  }

  return null
}
