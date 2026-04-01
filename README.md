# Tracktio — AI-Powered ERP

The ERP that runs your entire business. CRM, invoicing, inventory, manufacturing, HR, accounting, POS, and e-commerce — all in one platform.

**Zero configuration. No specialist needed. Ready in 60 seconds.**

## Why Tracktio?

| Feature | Tracktio | Odoo | SAP B1 | Zoho |
|---------|----------|------|--------|------|
| Setup time | 60 sec | 2-6 weeks | 3-6 months | 1-2 weeks |
| WhatsApp native | Yes | Addon | No | No |
| AI scoring | Yes | No | No | Partial |
| Email auto-sync | Yes | Addon | No | Partial |
| Manufacturing | Yes | Yes | Yes | No |
| POS included | Yes | Addon | No | Addon |
| E-commerce | Yes | Yes | No | Addon |
| HR & Payroll | Yes | Partial | No | Partial |

## Modules (27)

**Sales:** Pipeline, Contacts, Quotes, Invoices, POS, E-commerce
**Operations:** Inventory, Purchasing, Manufacturing
**Finance:** Accounting, Expenses, Financial Reports (P&L, Balance Sheet, Cash Flow)
**People:** HR & Payroll, Team, Roles & Permissions
**AI:** Engagement scoring, proposal tracking, call transcription, proactive notifications
**Integrations:** Gmail, Outlook, WhatsApp, LinkedIn, Twilio, Stripe, 20+
**Tools:** Automations, Global Search (Cmd+K), API (50+ REST endpoints), Audit Log

## Tech Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** Supabase (PostgreSQL + Row-Level Security)
- **AI:** Claude API (insights, call analysis, scoring)
- **Payments:** Stripe
- **Deployment:** Vercel + Docker

## Quick Start

```bash
git clone https://github.com/camargo651-sys/FlowCRM.git
cd FlowCRM
npm install
cp .env.example .env.local  # Add your Supabase keys
npm run dev
```

Open http://localhost:3000

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_claude_api_key
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_ENCRYPTION_KEY=any_random_string
```

## Database Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor.

## API

Full REST API at `/api/v1/` with Bearer token authentication.

```bash
curl -H "Authorization: Bearer flw_your_key" https://your-domain/api/v1/contacts
```

50+ endpoints: contacts, deals, products, invoices, payments, purchase-orders, suppliers, accounts, journal-entries, employees, departments, leave-requests, payroll, quotes, bom, work-orders, approvals, recurring-invoices.

## Tests

```bash
npm test          # 41 unit tests (vitest)
npm run test:e2e  # 40 E2E tests (playwright)
npm run test:all  # All 81 tests
```

## Docker

```bash
docker-compose up
```

## Architecture

- **RBAC:** 8 default roles + custom roles with permission matrix (14 modules x 6 actions)
- **Event Bus:** Domain events connect all modules (deal.won -> invoice + stock + notification)
- **Rate Limiting:** Per-user API throttling
- **Validation:** Zod schemas on all inputs
- **Audit Trail:** Every action logged
- **Multi-language:** Spanish + English

## License

MIT
