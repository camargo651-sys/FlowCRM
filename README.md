# FlowCRM 🚀

A fully customizable CRM for modern sales teams — built with Next.js, Supabase, and Tailwind CSS.

## Stack

- **Frontend**: Next.js 14 + TypeScript
- **Database**: Supabase (PostgreSQL + Auth + Real-time)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deploy**: Vercel

## Setup

### 1. Clone and install

```bash
git clone https://github.com/camargo651-sys/FlowCRM.git
cd FlowCRM
npm install
```

### 2. Set up Supabase

1. Go to your [Supabase project](https://supabase.com)
2. Open **SQL Editor** → **New query**
3. Paste the contents of `supabase/schema.sql` and click **Run**

### 3. Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key  # optional for now
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. In Vercel, add these environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy — done!

## Features

- ✅ Auth (sign up / sign in)
- ✅ Multi-workspace support
- ✅ Kanban pipeline (drag & drop)
- ✅ Contacts & Companies
- ✅ Tasks & Activities
- ✅ Analytics dashboard
- ✅ Customizable pipeline stages
- 🔜 AI assistant (Claude)
- 🔜 Email integration
- 🔜 Team invitations
- 🔜 Custom fields
