export interface IntegrationDef {
  key: string
  name: string
  description: string
  category: string
  color: string
  icon: string // emoji for simplicity across the catalog
  popular?: boolean
  oauthFlow?: boolean // true = uses OAuth connect button instead of manual fields
  oauthUrl?: string   // API route to initiate OAuth
  fields: { key: string; label: string; placeholder: string; type?: string; help?: string }[]
  setupSteps: { step: number; title: string; description: string }[]
}

export const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'communication', label: 'Communication' },
  { key: 'email', label: 'Email & Calendar' },
  { key: 'social', label: 'Social Media' },
  { key: 'automation', label: 'Automation' },
  { key: 'payments', label: 'Payments' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'ecommerce', label: 'E-commerce' },
  { key: 'documents', label: 'Documents' },
  { key: 'developer', label: 'Developer' },
]

export const INTEGRATIONS_CATALOG: IntegrationDef[] = [
  // === COMMUNICATION ===
  {
    key: 'whatsapp', name: 'WhatsApp Business', category: 'communication', color: '#25D366', icon: '💬', popular: true,
    description: 'Capture WhatsApp conversations automatically. Contacts are created, messages logged, and you can reply directly from Tracktio.',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: '1234567890', help: 'WhatsApp Manager > API Setup > Phone Number ID' },
      { key: 'access_token', label: 'Permanent Access Token', placeholder: 'EAAx...', type: 'password', help: 'Meta Business > System Users > Generate Token' },
      { key: 'verify_token', label: 'Webhook Verify Token', placeholder: 'my-verify-token', help: 'Choose any string — use the same in Meta webhook config' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Meta Business Account', description: 'Go to business.facebook.com and create a Meta Business account.' },
      { step: 2, title: 'Set up WhatsApp Business API', description: 'In Meta Business Suite > WhatsApp Manager, set up the Cloud API with a phone number.' },
      { step: 3, title: 'Get API credentials', description: 'Copy Phone Number ID and generate a permanent System User access token with whatsapp_business_messaging permission.' },
      { step: 4, title: 'Configure Webhook', description: 'Set webhook URL to: https://your-domain.com/api/webhooks/whatsapp — use the same Verify Token you enter below.' },
      { step: 5, title: 'Subscribe to messages', description: 'In the webhook config, subscribe to the "messages" field.' },
    ],
  },
  {
    key: 'telegram', name: 'Telegram Bot', category: 'communication', color: '#0088CC', icon: '✈️',
    description: 'Receive leads and send notifications via Telegram bot.',
    fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password', help: 'From @BotFather on Telegram' },
      { key: 'chat_id', label: 'Chat/Group ID', placeholder: '-1001234567890', help: 'The chat where notifications are sent' },
    ],
    setupSteps: [
      { step: 1, title: 'Create a Telegram Bot', description: 'Message @BotFather on Telegram and use /newbot to create a bot.' },
      { step: 2, title: 'Copy the bot token', description: 'BotFather will give you a token. Paste it below.' },
      { step: 3, title: 'Get your Chat ID', description: 'Add the bot to a group, then use @userinfobot to find the chat ID.' },
    ],
  },
  {
    key: 'slack', name: 'Slack', category: 'communication', color: '#4A154B', icon: '#️⃣', popular: true,
    description: 'Get real-time notifications in Slack when deals move, tasks are due, or contacts are added.',
    fields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password', help: 'OAuth & Permissions page' },
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...', help: 'Incoming Webhooks page' },
      { key: 'channel', label: 'Default Channel', placeholder: '#sales', help: 'Channel for notifications' },
    ],
    setupSteps: [
      { step: 1, title: 'Create a Slack App', description: 'Go to api.slack.com/apps > Create New App > From scratch.' },
      { step: 2, title: 'Add permissions', description: 'OAuth & Permissions > Add: chat:write, incoming-webhook.' },
      { step: 3, title: 'Install to workspace', description: 'Click "Install to Workspace" and copy the Bot Token.' },
      { step: 4, title: 'Create webhook', description: 'Incoming Webhooks > Add New Webhook > Select channel.' },
    ],
  },
  {
    key: 'teams', name: 'Microsoft Teams', category: 'communication', color: '#6264A7', icon: '👥',
    description: 'Send deal updates and task notifications to Microsoft Teams channels.',
    fields: [
      { key: 'webhook_url', label: 'Incoming Webhook URL', placeholder: 'https://outlook.office.com/webhook/...', help: 'From Teams channel connector settings' },
    ],
    setupSteps: [
      { step: 1, title: 'Open Teams channel', description: 'Go to the channel where you want notifications.' },
      { step: 2, title: 'Add connector', description: 'Click "..." > Connectors > Incoming Webhook > Configure.' },
      { step: 3, title: 'Copy webhook URL', description: 'Name it "Tracktio" and copy the generated URL.' },
    ],
  },
  {
    key: 'twilio', name: 'Twilio (SMS)', category: 'communication', color: '#F22F46', icon: '📱',
    description: 'Send SMS messages to leads and clients. Automate reminders and follow-ups.',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxx', help: 'Twilio Console dashboard' },
      { key: 'auth_token', label: 'Auth Token', placeholder: 'xxxxxxxxxxxxxxx', type: 'password', help: 'Twilio Console dashboard' },
      { key: 'phone_number', label: 'Twilio Phone Number', placeholder: '+1234567890', help: 'Your Twilio phone number' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Twilio account', description: 'Sign up at twilio.com and verify your phone number.' },
      { step: 2, title: 'Get a phone number', description: 'Buy a phone number from the Twilio Console.' },
      { step: 3, title: 'Copy credentials', description: 'Find Account SID and Auth Token on the Twilio Console dashboard.' },
    ],
  },

  // === EMAIL & CALENDAR ===
  {
    key: 'gmail', name: 'Gmail', category: 'email', color: '#EA4335', icon: '📧', popular: true,
    oauthFlow: true, oauthUrl: '/api/auth/gmail',
    description: 'Automatically sync emails with contacts and deals. Zero manual data entry — emails are captured, contacts are created, and activities are logged automatically.',
    fields: [],
    setupSteps: [
      { step: 1, title: 'Click Connect', description: 'Click the button below to sign in with your Google account.' },
      { step: 2, title: 'Grant permissions', description: 'Allow Tracktio to read your emails (read-only access).' },
      { step: 3, title: 'Automatic sync', description: 'Emails will sync every 10 minutes. Contacts are created automatically.' },
    ],
  },
  {
    key: 'outlook', name: 'Outlook / Office 365', category: 'email', color: '#0078D4', icon: '📬',
    oauthFlow: true, oauthUrl: '/api/auth/outlook',
    description: 'Automatically sync Outlook emails with contacts and deals. Zero manual data entry — emails are captured, contacts are created, and activities are logged automatically.',
    fields: [],
    setupSteps: [
      { step: 1, title: 'Click Connect', description: 'Click the button below to sign in with your Microsoft account.' },
      { step: 2, title: 'Grant permissions', description: 'Allow Tracktio to read your emails (read-only access).' },
      { step: 3, title: 'Automatic sync', description: 'Emails will sync every 10 minutes. Contacts are created automatically.' },
    ],
  },
  {
    key: 'google_calendar', name: 'Google Calendar', category: 'email', color: '#4285F4', icon: '📅', popular: true,
    description: 'Sync meetings and events. Auto-create activities when you schedule calls.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxxx.apps.googleusercontent.com', help: 'Same as Gmail if configured' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password', help: 'Same as Gmail if configured' },
    ],
    setupSteps: [
      { step: 1, title: 'Enable Calendar API', description: 'Google Cloud Console > APIs & Services > Enable Google Calendar API.' },
      { step: 2, title: 'Use existing credentials', description: 'Use the same OAuth credentials as Gmail, or create new ones.' },
    ],
  },
  {
    key: 'calendly', name: 'Calendly', category: 'email', color: '#006BFF', icon: '🗓️', popular: true,
    description: 'Auto-create contacts and activities when someone books a Calendly meeting.',
    fields: [
      { key: 'api_key', label: 'Personal Access Token', placeholder: 'eyJhb...', type: 'password', help: 'Calendly > Integrations > API & Webhooks' },
      { key: 'webhook_signing_key', label: 'Webhook Signing Key', placeholder: 'whsec_...', type: 'password', help: 'Used to verify webhook payloads' },
    ],
    setupSteps: [
      { step: 1, title: 'Get API token', description: 'Go to Calendly > Integrations > API & Webhooks > Generate Token.' },
      { step: 2, title: 'Configure webhook', description: 'Set webhook URL: https://your-domain.com/api/webhooks/calendly' },
    ],
  },
  {
    key: 'zoom', name: 'Zoom', category: 'email', color: '#2D8CFF', icon: '📹',
    description: 'Create Zoom meetings from deals. Auto-log meeting recordings and notes.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxxxxxx', help: 'Zoom App Marketplace > Your App' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxxxxx', type: 'password', help: 'Zoom App Marketplace > Your App' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Zoom App', description: 'Go to marketplace.zoom.us > Develop > Build App > OAuth.' },
      { step: 2, title: 'Add scopes', description: 'Add scopes: meeting:write, meeting:read, user:read.' },
      { step: 3, title: 'Set redirect URL', description: 'Add: https://your-domain.com/api/auth/zoom/callback' },
    ],
  },
  {
    key: 'google_meet', name: 'Google Meet', category: 'email', color: '#00897B', icon: '🎥',
    description: 'Generate Google Meet links automatically when scheduling meetings.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxxx.apps.googleusercontent.com', help: 'Same as Google Calendar' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password', help: 'Same as Google Calendar' },
    ],
    setupSteps: [
      { step: 1, title: 'Use Google Calendar setup', description: 'Google Meet works through Google Calendar API. Use the same credentials.' },
    ],
  },

  // === SOCIAL MEDIA ===
  {
    key: 'instagram', name: 'Instagram DMs', category: 'social', color: '#E4405F', icon: '📸', popular: true,
    description: 'Receive Instagram DMs as leads. Reply to comments and messages from the CRM.',
    fields: [
      { key: 'page_id', label: 'Facebook Page ID', placeholder: '1234567890', help: 'Your Facebook Page linked to Instagram' },
      { key: 'access_token', label: 'Page Access Token', placeholder: 'EAAx...', type: 'password', help: 'Meta Business > System Users' },
    ],
    setupSteps: [
      { step: 1, title: 'Connect Instagram to Facebook', description: 'Your Instagram must be a Business account linked to a Facebook Page.' },
      { step: 2, title: 'Create Meta App', description: 'Go to developers.facebook.com > Create App > Business type.' },
      { step: 3, title: 'Add Instagram Messaging', description: 'Add the Instagram Graph API product and request messaging permissions.' },
      { step: 4, title: 'Generate token', description: 'Create a System User and generate a page access token.' },
    ],
  },
  {
    key: 'facebook_messenger', name: 'Facebook Messenger', category: 'social', color: '#0084FF', icon: '💭',
    description: 'Receive Messenger messages as leads. Automate responses and capture contacts.',
    fields: [
      { key: 'page_id', label: 'Page ID', placeholder: '1234567890', help: 'Your Facebook Page ID' },
      { key: 'access_token', label: 'Page Access Token', placeholder: 'EAAx...', type: 'password', help: 'Meta for Developers' },
      { key: 'verify_token', label: 'Webhook Verify Token', placeholder: 'my-verify-token' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Meta App', description: 'developers.facebook.com > Create App > Business.' },
      { step: 2, title: 'Add Messenger product', description: 'Add Messenger to your app and connect your Page.' },
      { step: 3, title: 'Configure webhook', description: 'Set URL: https://your-domain.com/api/webhooks/messenger' },
    ],
  },
  {
    key: 'linkedin', name: 'LinkedIn', category: 'social', color: '#0A66C2', icon: '💼',
    oauthFlow: true, oauthUrl: '/api/auth/linkedin',
    description: 'Connect your LinkedIn account to import contacts with their company, title, and profile data automatically.',
    fields: [],
    setupSteps: [
      { step: 1, title: 'Click Connect', description: 'Click the button below to sign in with your LinkedIn account.' },
      { step: 2, title: 'Grant permissions', description: 'Allow Tracktio to access your basic profile and email.' },
      { step: 3, title: 'Import contacts', description: 'Your LinkedIn connections will be available to import into the CRM.' },
    ],
  },

  // === AUTOMATION ===
  {
    key: 'zapier', name: 'Zapier', category: 'automation', color: '#FF4F00', icon: '⚡', popular: true,
    description: 'Connect with 5,000+ apps. Automate any workflow without writing code.',
    fields: [
      { key: 'api_key', label: 'Tracktio API Key', placeholder: 'Auto-generated', help: 'Use this key in Zapier' },
      { key: 'webhook_url', label: 'Zapier Webhook URL', placeholder: 'https://hooks.zapier.com/...', help: 'From your Zap configuration' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Zapier account', description: 'Sign up at zapier.com (free plan available).' },
      { step: 2, title: 'Create a Zap', description: 'Use Webhooks trigger and paste your Tracktio API endpoint.' },
    ],
  },
  {
    key: 'make', name: 'Make (Integromat)', category: 'automation', color: '#6D00CC', icon: '🔄',
    description: 'Visual automation builder. Create complex workflows with branching logic.',
    fields: [
      { key: 'api_key', label: 'Tracktio API Key', placeholder: 'Auto-generated', help: 'Use this key in Make' },
      { key: 'webhook_url', label: 'Make Webhook URL', placeholder: 'https://hook.make.com/...', help: 'From your Make scenario' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Make account', description: 'Sign up at make.com (free plan available).' },
      { step: 2, title: 'Create scenario', description: 'Add a Webhook module and paste the Tracktio endpoint.' },
    ],
  },
  {
    key: 'n8n', name: 'n8n', category: 'automation', color: '#EA4B71', icon: '🔧',
    description: 'Self-hosted automation. Full control over your data and workflows.',
    fields: [
      { key: 'webhook_url', label: 'n8n Webhook URL', placeholder: 'https://your-n8n.com/webhook/...', help: 'From your n8n workflow' },
      { key: 'api_key', label: 'Tracktio API Key', placeholder: 'Auto-generated', help: 'Use in n8n HTTP Request node' },
    ],
    setupSteps: [
      { step: 1, title: 'Install n8n', description: 'Self-host n8n or use n8n.cloud.' },
      { step: 2, title: 'Create workflow', description: 'Add Webhook trigger node and configure HTTP Request nodes.' },
    ],
  },

  // === PAYMENTS ===
  {
    key: 'stripe', name: 'Stripe', category: 'payments', color: '#635BFF', icon: '💳', popular: true,
    description: 'Track payments and revenue. Update deal status when payments are received.',
    fields: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password', help: 'Stripe Dashboard > Developers > API keys' },
      { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password', help: 'Stripe > Developers > Webhooks' },
      { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...', help: 'Stripe Dashboard > API keys' },
    ],
    setupSteps: [
      { step: 1, title: 'Get Stripe API keys', description: 'dashboard.stripe.com > Developers > API keys.' },
      { step: 2, title: 'Create webhook', description: 'Webhooks > Add endpoint: https://your-domain.com/api/webhooks/stripe' },
      { step: 3, title: 'Select events', description: 'Listen to: payment_intent.succeeded, invoice.paid, customer.created.' },
    ],
  },
  {
    key: 'mercadopago', name: 'MercadoPago', category: 'payments', color: '#009EE3', icon: '🏦',
    description: 'Process payments in Latin America. Generate payment links from quotes.',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password', help: 'MercadoPago Developers > Your apps' },
      { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-...', help: 'MercadoPago Developers > Your apps' },
    ],
    setupSteps: [
      { step: 1, title: 'Create MercadoPago app', description: 'Go to mercadopago.com/developers > Your integrations > Create app.' },
      { step: 2, title: 'Get credentials', description: 'Copy Access Token and Public Key from your app settings.' },
    ],
  },
  {
    key: 'paypal', name: 'PayPal', category: 'payments', color: '#003087', icon: '💰',
    description: 'Accept PayPal payments. Generate invoices and payment links.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxxxxxx', help: 'PayPal Developer Dashboard' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'xxxxxxxx', type: 'password', help: 'PayPal Developer Dashboard' },
    ],
    setupSteps: [
      { step: 1, title: 'Create PayPal App', description: 'developer.paypal.com > Apps & Credentials > Create App.' },
      { step: 2, title: 'Get credentials', description: 'Copy Client ID and Secret from your app.' },
    ],
  },

  // === PRODUCTIVITY ===
  {
    key: 'google_sheets', name: 'Google Sheets', category: 'productivity', color: '#0F9D58', icon: '📊', popular: true,
    description: 'Import/export contacts, deals, and reports. Keep spreadsheets in sync.',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'xxxxx.apps.googleusercontent.com', help: 'Google Cloud Console' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'GOCSPX-...', type: 'password', help: 'Google Cloud Console' },
      { key: 'spreadsheet_id', label: 'Spreadsheet ID', placeholder: '1BxiMVs0XRA5n...', help: 'From your Google Sheets URL' },
    ],
    setupSteps: [
      { step: 1, title: 'Enable Sheets API', description: 'Google Cloud Console > Enable Google Sheets API.' },
      { step: 2, title: 'Use OAuth credentials', description: 'Use same credentials as Gmail/Calendar or create new ones.' },
    ],
  },
  {
    key: 'notion', name: 'Notion', category: 'productivity', color: '#000000', icon: '📝',
    description: 'Sync deal notes and meeting summaries to Notion databases.',
    fields: [
      { key: 'api_key', label: 'Integration Token', placeholder: 'secret_...', type: 'password', help: 'notion.so/my-integrations' },
      { key: 'database_id', label: 'Database ID', placeholder: 'xxxxxxxx', help: 'From your Notion database URL' },
    ],
    setupSteps: [
      { step: 1, title: 'Create Notion integration', description: 'Go to notion.so/my-integrations > Create new integration.' },
      { step: 2, title: 'Share database', description: 'Open your Notion database > Share > Add your integration.' },
    ],
  },
  {
    key: 'trello', name: 'Trello', category: 'productivity', color: '#0052CC', icon: '📋',
    description: 'Sync deals as Trello cards. Move cards when deal stages change.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx', help: 'trello.com/app-key' },
      { key: 'token', label: 'Token', placeholder: 'xxxxxxxx', type: 'password', help: 'Generated from API key page' },
      { key: 'board_id', label: 'Board ID', placeholder: 'xxxxxxxx', help: 'From your Trello board URL' },
    ],
    setupSteps: [
      { step: 1, title: 'Get API Key', description: 'Go to trello.com/app-key and copy your API key.' },
      { step: 2, title: 'Generate token', description: 'Click the Token link on the same page and authorize.' },
    ],
  },

  // === ANALYTICS ===
  {
    key: 'google_analytics', name: 'Google Analytics', category: 'analytics', color: '#E37400', icon: '📈',
    description: 'Track lead sources and conversion paths from your website to CRM.',
    fields: [
      { key: 'measurement_id', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', help: 'GA4 > Admin > Data Streams' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'xxxxxxxx', type: 'password', help: 'GA4 > Admin > Data Streams > Measurement Protocol' },
    ],
    setupSteps: [
      { step: 1, title: 'Get Measurement ID', description: 'Google Analytics > Admin > Data Streams > Select stream.' },
      { step: 2, title: 'Create API Secret', description: 'In the stream details, create a Measurement Protocol API secret.' },
    ],
  },
  {
    key: 'facebook_pixel', name: 'Facebook Pixel', category: 'analytics', color: '#1877F2', icon: '📊',
    description: 'Track conversions from Facebook/Instagram ads to closed deals.',
    fields: [
      { key: 'pixel_id', label: 'Pixel ID', placeholder: '1234567890', help: 'Meta Events Manager' },
      { key: 'access_token', label: 'Conversions API Token', placeholder: 'EAAx...', type: 'password', help: 'Meta Events Manager > Settings' },
    ],
    setupSteps: [
      { step: 1, title: 'Get Pixel ID', description: 'Meta Events Manager > Data Sources > Select your Pixel.' },
      { step: 2, title: 'Generate token', description: 'Settings > Conversions API > Generate access token.' },
    ],
  },

  // === E-COMMERCE ===
  {
    key: 'shopify', name: 'Shopify', category: 'ecommerce', color: '#96BF48', icon: '🛍️',
    description: 'Import Shopify customers as contacts. Track orders as deals.',
    fields: [
      { key: 'shop_url', label: 'Shop URL', placeholder: 'your-store.myshopify.com', help: 'Your Shopify store URL' },
      { key: 'access_token', label: 'Admin API Access Token', placeholder: 'shpat_...', type: 'password', help: 'Settings > Apps > Develop apps' },
    ],
    setupSteps: [
      { step: 1, title: 'Create custom app', description: 'Shopify Admin > Settings > Apps > Develop apps > Create app.' },
      { step: 2, title: 'Configure API scopes', description: 'Add: read_customers, read_orders, read_products.' },
      { step: 3, title: 'Install and get token', description: 'Install the app and copy the Admin API access token.' },
    ],
  },
  {
    key: 'woocommerce', name: 'WooCommerce', category: 'ecommerce', color: '#96588A', icon: '🛒',
    description: 'Sync WooCommerce customers and orders with your CRM.',
    fields: [
      { key: 'store_url', label: 'Store URL', placeholder: 'https://your-store.com', help: 'Your WordPress site URL' },
      { key: 'consumer_key', label: 'Consumer Key', placeholder: 'ck_...', help: 'WooCommerce > Settings > REST API' },
      { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'cs_...', type: 'password', help: 'WooCommerce > Settings > REST API' },
    ],
    setupSteps: [
      { step: 1, title: 'Create API keys', description: 'WooCommerce > Settings > Advanced > REST API > Add key.' },
      { step: 2, title: 'Set permissions', description: 'Set permissions to Read/Write and generate keys.' },
    ],
  },

  // === DOCUMENTS ===
  {
    key: 'docusign', name: 'DocuSign', category: 'documents', color: '#FFCD00', icon: '✍️',
    description: 'Send contracts for e-signature. Track document status from deals.',
    fields: [
      { key: 'integration_key', label: 'Integration Key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', help: 'DocuSign Admin > Integrations' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'xxxxxxxx', type: 'password', help: 'DocuSign Admin > Integrations' },
      { key: 'account_id', label: 'Account ID', placeholder: 'xxxxxxxx', help: 'DocuSign Admin > Account' },
    ],
    setupSteps: [
      { step: 1, title: 'Create DocuSign app', description: 'DocuSign Admin > Integrations > Add App/Integration Key.' },
      { step: 2, title: 'Configure redirect', description: 'Add redirect: https://your-domain.com/api/auth/docusign/callback' },
      { step: 3, title: 'Copy credentials', description: 'Copy Integration Key, Secret Key, and Account ID.' },
    ],
  },
  {
    key: 'pandadoc', name: 'PandaDoc', category: 'documents', color: '#38B249', icon: '📄',
    description: 'Create proposals and contracts from deal data. Track document analytics.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx', type: 'password', help: 'PandaDoc > Settings > Integrations > API' },
    ],
    setupSteps: [
      { step: 1, title: 'Get API key', description: 'PandaDoc > Settings > Integrations > API > Generate key.' },
    ],
  },

  // === EMAIL MARKETING ===
  {
    key: 'mailchimp', name: 'Mailchimp', category: 'email', color: '#FFE01B', icon: '🐵',
    description: 'Sync contacts to Mailchimp audiences. Trigger email campaigns from deal stages.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx-us1', type: 'password', help: 'Mailchimp > Account > Extras > API keys' },
      { key: 'audience_id', label: 'Audience ID', placeholder: 'xxxxxxxx', help: 'Mailchimp > Audience > Settings > Audience name and defaults' },
    ],
    setupSteps: [
      { step: 1, title: 'Get API key', description: 'Mailchimp > Account > Extras > API keys > Create a key.' },
      { step: 2, title: 'Find Audience ID', description: 'Audience > Settings > Audience name and defaults > Audience ID.' },
    ],
  },

  // === DEVELOPER ===
  {
    key: 'webhooks', name: 'Custom Webhooks', category: 'developer', color: '#333333', icon: '🔗', popular: true,
    description: 'Send real-time events to any URL. Build custom integrations with any system.',
    fields: [
      { key: 'url', label: 'Webhook URL', placeholder: 'https://your-app.com/webhooks/tracktio', help: 'URL that receives POST requests' },
      { key: 'secret', label: 'Signing Secret', placeholder: 'whsec_...', type: 'password', help: 'Used to verify webhook authenticity' },
      { key: 'events', label: 'Events', placeholder: 'deal.created, deal.updated, contact.created', help: 'Comma-separated list of events' },
    ],
    setupSteps: [
      { step: 1, title: 'Set your URL', description: 'Enter the URL where you want to receive event notifications.' },
      { step: 2, title: 'Choose events', description: 'Select which events trigger webhooks (deals, contacts, quotes, etc.).' },
      { step: 3, title: 'Verify signature', description: 'Use the signing secret to verify webhook payloads in your app.' },
    ],
  },
  {
    key: 'rest_api', name: 'REST API', category: 'developer', color: '#10B981', icon: '🛠️',
    description: 'Full API access to your CRM data. Build custom apps and dashboards.',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'Auto-generated', help: 'Use this key in your API requests' },
    ],
    setupSteps: [
      { step: 1, title: 'Generate API key', description: 'Your API key will be generated automatically. Use it in the Authorization header.' },
      { step: 2, title: 'Read the docs', description: 'API documentation: https://your-domain.com/api/docs' },
    ],
  },
]
