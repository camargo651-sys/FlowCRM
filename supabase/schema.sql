-- ============================================================
-- FLOWCRM - Supabase Schema
-- Run this in: Supabase > SQL Editor > New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- WORKSPACES
-- ============================================================
create table if not exists workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique,
  plan        text default 'free' check (plan in ('free','starter','growth','scale')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  logo_url    text,
  primary_color text default '#6172f3',
  industry    text,
  team_size   text,
  language    text default 'en',
  terminology jsonb default '{}',
  onboarding_completed boolean default false,
  created_at  timestamptz default now()
);

alter table workspaces enable row level security;
create policy "Users manage own workspace" on workspaces
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  workspace_id  uuid references workspaces(id) on delete cascade,
  full_name     text not null default '',
  email         text,
  avatar_url    text,
  role          text default 'admin' check (role in ('admin','manager','member')),
  created_at    timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users manage own profile" on profiles
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Workspace members can view profiles" on profiles
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- PIPELINES
-- ============================================================
create table if not exists pipelines (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  color         text default '#6172f3',
  order_index   int default 0,
  contact_id    uuid references contacts(id) on delete set null,
  created_at    timestamptz default now()
);

alter table pipelines enable row level security;
create policy "Workspace owner manages pipelines" on pipelines
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- PIPELINE STAGES
-- ============================================================
create table if not exists pipeline_stages (
  id            uuid primary key default uuid_generate_v4(),
  pipeline_id   uuid not null references pipelines(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  order_index   int default 0,
  color         text default '#6172f3',
  win_stage     boolean default false,
  lost_stage    boolean default false,
  created_at    timestamptz default now()
);

alter table pipeline_stages enable row level security;
create policy "Workspace owner manages stages" on pipeline_stages
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists contacts (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  type          text default 'person' check (type in ('person','company')),
  name          text not null,
  email         text,
  phone         text,
  company_name  text,
  company_id    uuid references contacts(id),
  job_title     text,
  website       text,
  address       text,
  tags          text[],
  notes         text,
  custom_fields jsonb default '{}',
  owner_id      uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table contacts enable row level security;
create policy "Workspace owner manages contacts" on contacts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- DEALS
-- ============================================================
create table if not exists deals (
  id                    uuid primary key default uuid_generate_v4(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  pipeline_id           uuid references pipelines(id) on delete set null,
  stage_id              uuid references pipeline_stages(id) on delete set null,
  title                 text not null,
  value                 numeric,
  currency              text default 'USD',
  contact_id            uuid references contacts(id) on delete set null,
  company_id            uuid references contacts(id) on delete set null,
  owner_id              uuid references auth.users(id),
  probability           int default 0 check (probability >= 0 and probability <= 100),
  expected_close_date   date,
  status                text default 'open' check (status in ('open','won','lost')),
  lost_reason           text,
  tags                  text[],
  custom_fields         jsonb default '{}',
  order_index           int default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table deals enable row level security;
create policy "Workspace owner manages deals" on deals
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- ACTIVITIES (Tasks, calls, emails, meetings, notes)
-- ============================================================
create table if not exists activities (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  type          text default 'task' check (type in ('call','email','meeting','note','task')),
  title         text not null,
  notes         text,
  deal_id       uuid references deals(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  owner_id      uuid references auth.users(id),
  due_date      timestamptz,
  done          boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table activities enable row level security;
create policy "Workspace owner manages activities" on activities
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================
create table if not exists custom_field_defs (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  entity        text not null check (entity in ('deal','contact','company')),
  label         text not null,
  key           text not null,
  type          text not null check (type in ('text','number','currency','date','select','boolean','url')),
  options       text[],
  required      boolean default false,
  order_index   int default 0,
  created_at    timestamptz default now(),
  unique(workspace_id, entity, key)
);

alter table custom_field_defs enable row level security;
create policy "Workspace owner manages custom fields" on custom_field_defs
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger contacts_updated_at before update on contacts for each row execute function update_updated_at();
create trigger deals_updated_at before update on deals for each row execute function update_updated_at();
create trigger activities_updated_at before update on activities for each row execute function update_updated_at();

-- ============================================================
-- TRIGGER: Auto-create workspace + profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  -- Create workspace
  insert into workspaces (owner_id, name, slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'workspace_name', 'My Workspace'),
    coalesce(new.raw_user_meta_data->>'workspace_slug', 'workspace-' || substr(new.id::text, 1, 8))
  )
  returning id into new_workspace_id;

  -- Create profile
  insert into profiles (id, workspace_id, full_name, email, role)
  values (
    new.id,
    new_workspace_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'admin'
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- INTEGRATIONS
-- ============================================================
create table if not exists integrations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  key           text not null,
  name          text not null,
  enabled       boolean default false,
  config        jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(workspace_id, key)
);

alter table integrations enable row level security;
create policy "Workspace owner manages integrations" on integrations
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create trigger integrations_updated_at before update on integrations for each row execute function update_updated_at();

-- ============================================================
-- QUOTES / PROPOSALS
-- ============================================================
create table if not exists quotes (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  deal_id         uuid references deals(id) on delete set null,
  contact_id      uuid references contacts(id) on delete set null,
  quote_number    text not null,
  title           text not null,
  status          text default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  currency        text default 'USD',
  subtotal        numeric default 0,
  discount_type   text default 'percent' check (discount_type in ('percent','fixed')),
  discount_value  numeric default 0,
  tax_rate        numeric default 0,
  tax_amount      numeric default 0,
  total           numeric default 0,
  notes           text,
  terms           text,
  valid_until      date,
  sent_at         timestamptz,
  accepted_at     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table quotes enable row level security;
create policy "Workspace owner manages quotes" on quotes
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create trigger quotes_updated_at before update on quotes for each row execute function update_updated_at();

create table if not exists quote_items (
  id            uuid primary key default uuid_generate_v4(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  product_id    uuid references products(id) on delete set null,
  description   text not null,
  quantity      numeric default 1,
  unit_price    numeric default 0,
  discount      numeric default 0,
  total         numeric default 0,
  order_index   int default 0
);

alter table quote_items enable row level security;
create policy "Quote items follow quote access" on quote_items
  using (quote_id in (select id from quotes where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- ADD metadata COLUMN TO ACTIVITIES (for email linking)
-- ============================================================
alter table activities add column if not exists metadata jsonb default '{}';

-- ============================================================
-- EMAIL ACCOUNTS (OAuth tokens for Gmail / Outlook)
-- ============================================================
create table if not exists email_accounts (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null check (provider in ('gmail','outlook')),
  email_address   text not null,
  access_token    text not null,
  refresh_token   text not null,
  token_expires_at timestamptz not null,
  scopes          text[],
  sync_cursor     text,
  last_synced_at  timestamptz,
  status          text default 'active' check (status in ('active','expired','revoked','error')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(workspace_id, email_address)
);

alter table email_accounts enable row level security;
create policy "Workspace owner manages email accounts" on email_accounts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create trigger email_accounts_updated_at before update on email_accounts for each row execute function update_updated_at();

-- ============================================================
-- EMAIL MESSAGES (synced email metadata)
-- ============================================================
create table if not exists email_messages (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  email_account_id    uuid not null references email_accounts(id) on delete cascade,
  provider_message_id text not null,
  thread_id           text,
  subject             text,
  snippet             text,
  from_address        text not null,
  from_name           text,
  to_addresses        jsonb default '[]',
  cc_addresses        jsonb default '[]',
  direction           text not null check (direction in ('inbound','outbound')),
  received_at         timestamptz not null,
  is_read             boolean default false,
  labels              text[],
  contact_id          uuid references contacts(id) on delete set null,
  deal_id             uuid references deals(id) on delete set null,
  created_at          timestamptz default now(),
  unique(email_account_id, provider_message_id)
);

alter table email_messages enable row level security;
create policy "Workspace owner manages email messages" on email_messages
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- EMAIL SYNC LOG (debugging / stats)
-- ============================================================
create table if not exists email_sync_log (
  id                uuid primary key default uuid_generate_v4(),
  email_account_id  uuid not null references email_accounts(id) on delete cascade,
  started_at        timestamptz default now(),
  completed_at      timestamptz,
  messages_synced   int default 0,
  contacts_created  int default 0,
  contacts_updated  int default 0,
  error             text,
  status            text default 'running' check (status in ('running','completed','failed'))
);

alter table email_sync_log enable row level security;
create policy "Email sync log follows account access" on email_sync_log
  using (email_account_id in (select id from email_accounts where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- ALTER ACTIVITIES: add 'whatsapp' type
-- ============================================================
alter table activities drop constraint if exists activities_type_check;
alter table activities add constraint activities_type_check
  check (type in ('call','email','meeting','note','task','whatsapp'));

-- ============================================================
-- WHATSAPP ACCOUNTS
-- ============================================================
create table if not exists whatsapp_accounts (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  phone_number_id text not null,
  waba_id         text,
  display_phone   text,
  access_token    text not null,
  verify_token    text not null,
  status          text default 'active' check (status in ('active','error','revoked')),
  last_webhook_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(workspace_id, phone_number_id)
);

alter table whatsapp_accounts enable row level security;
create policy "Workspace owner manages whatsapp accounts" on whatsapp_accounts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger whatsapp_accounts_updated_at before update on whatsapp_accounts for each row execute function update_updated_at();

-- ============================================================
-- WHATSAPP MESSAGES
-- ============================================================
create table if not exists whatsapp_messages (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  whatsapp_account_id uuid not null references whatsapp_accounts(id) on delete cascade,
  wamid               text not null,
  conversation_id     text,
  from_number         text not null,
  to_number           text not null,
  direction           text not null check (direction in ('inbound','outbound')),
  message_type        text default 'text' check (message_type in ('text','image','video','document','audio','location','template','reaction','sticker')),
  body                text,
  media_url           text,
  media_mime_type     text,
  status              text default 'sent' check (status in ('sent','delivered','read','failed')),
  status_updated_at   timestamptz,
  contact_id          uuid references contacts(id) on delete set null,
  deal_id             uuid references deals(id) on delete set null,
  metadata            jsonb default '{}',
  received_at         timestamptz not null,
  created_at          timestamptz default now(),
  unique(whatsapp_account_id, wamid)
);

alter table whatsapp_messages enable row level security;
create policy "Workspace owner manages whatsapp messages" on whatsapp_messages
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- WHATSAPP CONTACTS (WA profile cache)
-- ============================================================
create table if not exists whatsapp_contacts (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  wa_id         text not null,
  profile_name  text,
  contact_id    uuid references contacts(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(workspace_id, wa_id)
);

alter table whatsapp_contacts enable row level security;
create policy "Workspace owner manages whatsapp contacts" on whatsapp_contacts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger whatsapp_contacts_updated_at before update on whatsapp_contacts for each row execute function update_updated_at();

-- Enable Realtime for WhatsApp messages
alter publication supabase_realtime add table whatsapp_messages;

-- ============================================================
-- LINKEDIN ACCOUNTS
-- ============================================================
create table if not exists linkedin_accounts (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  linkedin_id     text not null,
  name            text,
  email           text,
  profile_url     text,
  access_token    text not null,
  refresh_token   text,
  token_expires_at timestamptz not null,
  scopes          text[],
  status          text default 'active' check (status in ('active','expired','revoked','error')),
  last_synced_at  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(workspace_id, linkedin_id)
);

alter table linkedin_accounts enable row level security;
create policy "Workspace owner manages linkedin accounts" on linkedin_accounts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger linkedin_accounts_updated_at before update on linkedin_accounts for each row execute function update_updated_at();

-- ============================================================
-- LINKEDIN CONNECTIONS (synced contacts from LinkedIn)
-- ============================================================
create table if not exists linkedin_connections (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  linkedin_account_id uuid not null references linkedin_accounts(id) on delete cascade,
  linkedin_id     text not null,
  first_name      text,
  last_name       text,
  headline        text,
  profile_url     text,
  email           text,
  company         text,
  position        text,
  contact_id      uuid references contacts(id) on delete set null,
  synced_at       timestamptz default now(),
  created_at      timestamptz default now(),
  unique(linkedin_account_id, linkedin_id)
);

alter table linkedin_connections enable row level security;
create policy "Workspace owner manages linkedin connections" on linkedin_connections
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- CALL LOGS (transcribed calls from Twilio, Zoom, etc.)
-- ============================================================
create table if not exists call_logs (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  provider        text default 'manual' check (provider in ('twilio','zoom','google_meet','manual')),
  external_id     text,
  from_number     text,
  to_number       text,
  direction       text check (direction in ('inbound','outbound')),
  duration_seconds int,
  started_at      timestamptz,
  ended_at        timestamptz,
  recording_url   text,
  transcript      text,
  summary         text,
  sentiment       text check (sentiment in ('positive','neutral','negative')),
  key_topics      text[],
  next_actions    text[],
  contact_id      uuid references contacts(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  owner_id        uuid references auth.users(id),
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

alter table call_logs enable row level security;
create policy "Workspace owner manages call logs" on call_logs
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- ENGAGEMENT SIGNALS (real-time events for AI scoring)
-- ============================================================
create table if not exists engagement_signals (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete cascade,
  deal_id         uuid references deals(id) on delete set null,
  signal_type     text not null check (signal_type in (
    'email_opened','email_replied','email_sent','email_received',
    'whatsapp_received','whatsapp_sent','whatsapp_read',
    'call_completed','call_positive','call_negative',
    'quote_viewed','quote_sent','quote_accepted','quote_rejected',
    'deal_stage_changed','deal_created','deal_stale',
    'meeting_scheduled','meeting_completed',
    'linkedin_connected','contact_created'
  )),
  strength        int default 1 check (strength >= 1 and strength <= 10),
  source          text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

alter table engagement_signals enable row level security;
create policy "Workspace owner manages signals" on engagement_signals
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- Index for fast scoring queries
create index if not exists idx_signals_contact on engagement_signals(contact_id, created_at desc);
create index if not exists idx_signals_deal on engagement_signals(deal_id, created_at desc);

-- ============================================================
-- CONTACT SCORES (AI-calculated engagement scores)
-- ============================================================
alter table contacts add column if not exists engagement_score int default 0;
alter table contacts add column if not exists score_label text default 'cold' check (score_label in ('hot','warm','cold','inactive'));
alter table contacts add column if not exists last_interaction_at timestamptz;
alter table contacts add column if not exists interaction_count int default 0;

-- ============================================================
-- DEAL SCORES (AI-calculated win probability)
-- ============================================================
alter table deals add column if not exists ai_score int default 0;
alter table deals add column if not exists ai_risk text check (ai_risk in ('on_track','at_risk','critical'));
alter table deals add column if not exists ai_next_action text;

-- ============================================================
-- AUTOMATIONS (industry-specific workflow rules)
-- ============================================================
create table if not exists automations (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  enabled         boolean default true,
  trigger_type    text not null check (trigger_type in (
    'deal_stage_changed','deal_created','deal_idle','deal_won','deal_lost',
    'contact_created','contact_birthday',
    'task_overdue','task_due_soon',
    'quote_sent','quote_accepted','quote_rejected',
    'whatsapp_received','email_received',
    'schedule_daily','schedule_weekly','schedule_monthly'
  )),
  trigger_config  jsonb default '{}',
  action_type     text not null check (action_type in (
    'create_task','send_whatsapp','send_email','notify_team',
    'update_deal','update_contact','create_deal','webhook'
  )),
  action_config   jsonb default '{}',
  last_triggered  timestamptz,
  trigger_count   int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table automations enable row level security;
create policy "Workspace owner manages automations" on automations
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger automations_updated_at before update on automations for each row execute function update_updated_at();

-- ============================================================
-- QUOTE VIEW TRACKING (proposal analytics)
-- ============================================================
alter table quotes add column if not exists view_token text unique;
alter table quotes add column if not exists view_count int default 0;
alter table quotes add column if not exists last_viewed_at timestamptz;
alter table quotes add column if not exists avg_view_seconds int default 0;

create table if not exists quote_views (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  quote_id        uuid not null references quotes(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete set null,
  ip_address      text,
  user_agent      text,
  duration_seconds int default 0,
  sections_viewed  text[],
  created_at       timestamptz default now()
);

alter table quote_views enable row level security;
create policy "Workspace owner manages quote views" on quote_views
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- NOTIFICATIONS (real-time proactive alerts)
-- ============================================================
create table if not exists notifications (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in (
    'quote_viewed','hot_contact','deal_at_risk','whatsapp_received',
    'email_replied','call_positive','task_overdue','deal_won',
    'automation_fired','system'
  )),
  title           text not null,
  body            text,
  icon            text,
  priority        text default 'medium' check (priority in ('low','medium','high','urgent')),
  read            boolean default false,
  action_url      text,
  contact_id      uuid references contacts(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

alter table notifications enable row level security;
create policy "User manages own notifications" on notifications
  using (user_id = auth.uid());

create index if not exists idx_notifications_user on notifications(user_id, read, created_at desc);
alter publication supabase_realtime add table notifications;

-- ============================================================
-- TEAM INVITATIONS
-- ============================================================
create table if not exists team_invitations (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  email           text not null,
  role            text default 'member' check (role in ('admin','manager','member')),
  invited_by      uuid not null references auth.users(id),
  token           text unique not null,
  status          text default 'pending' check (status in ('pending','accepted','expired','revoked')),
  accepted_at     timestamptz,
  expires_at      timestamptz default (now() + interval '7 days'),
  created_at      timestamptz default now()
);

alter table team_invitations enable row level security;
create policy "Workspace owner manages invitations" on team_invitations
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- INVENTORY / STOCK (configurable product types)
-- ============================================================
create table if not exists product_categories (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  type            text default 'basic' check (type in ('basic','apparel','technical','digital','service')),
  icon            text,
  fields_config   jsonb default '[]',
  created_at      timestamptz default now(),
  unique(workspace_id, name)
);

alter table product_categories enable row level security;
create policy "Workspace owner manages categories" on product_categories
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists products (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  category_id     uuid references product_categories(id) on delete set null,
  sku             text,
  name            text not null,
  description     text,
  unit_price      numeric default 0,
  cost_price      numeric default 0,
  currency        text default 'USD',
  stock_quantity  int default 0,
  min_stock       int default 0,
  max_stock       int,
  unit            text default 'unit',
  status          text default 'active' check (status in ('active','inactive','discontinued')),
  image_url       text,
  barcode         text,
  -- Apparel-specific
  sizes           text[],
  colors          text[],
  -- Technical-specific
  brand           text,
  model           text,
  specs           jsonb default '{}',
  warranty_months int,
  -- General custom fields
  custom_fields   jsonb default '{}',
  tags            text[],
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table products enable row level security;
create policy "Workspace owner manages products" on products
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger products_updated_at before update on products for each row execute function update_updated_at();

create table if not exists stock_movements (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  type            text not null check (type in ('purchase','sale','adjustment','return','transfer')),
  quantity        int not null,
  previous_stock  int not null,
  new_stock       int not null,
  unit_cost       numeric,
  reference       text,
  notes           text,
  deal_id         uuid references deals(id) on delete set null,
  contact_id      uuid references contacts(id) on delete set null,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

alter table stock_movements enable row level security;
create policy "Workspace owner manages stock movements" on stock_movements
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- API KEYS
-- ============================================================
create table if not exists api_keys (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  key_hash        text not null unique,
  key_prefix      text not null,
  scopes          text[] default '{"*"}',
  active          boolean default true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz default now()
);
alter table api_keys enable row level security;
create policy "Workspace owner manages api keys" on api_keys
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- INVOICES (Sales)
-- ============================================================
create table if not exists invoices (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  invoice_number  text not null,
  type            text default 'invoice' check (type in ('invoice','credit_note','debit_note')),
  contact_id      uuid references contacts(id) on delete set null,
  deal_id         uuid references deals(id) on delete set null,
  quote_id        uuid references quotes(id) on delete set null,
  status          text default 'draft' check (status in ('draft','sent','paid','partial','overdue','cancelled','refunded')),
  currency        text default 'USD',
  subtotal        numeric default 0,
  discount_type   text default 'percent',
  discount_value  numeric default 0,
  tax_rate        numeric default 0,
  tax_amount      numeric default 0,
  total           numeric default 0,
  amount_paid     numeric default 0,
  balance_due     numeric default 0,
  issue_date      date default current_date,
  due_date        date,
  paid_at         timestamptz,
  notes           text,
  terms           text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table invoices enable row level security;
create policy "Workspace owner manages invoices" on invoices
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger invoices_updated_at before update on invoices for each row execute function update_updated_at();

create table if not exists invoice_items (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references invoices(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  description     text not null,
  quantity        numeric default 1,
  unit_price      numeric default 0,
  discount        numeric default 0,
  tax_rate        numeric default 0,
  total           numeric default 0,
  order_index     int default 0
);
alter table invoice_items enable row level security;
create policy "Invoice items follow invoice" on invoice_items
  using (invoice_id in (select id from invoices where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- PAYMENTS
-- ============================================================
create table if not exists payments (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  invoice_id      uuid references invoices(id) on delete set null,
  contact_id      uuid references contacts(id) on delete set null,
  amount          numeric not null,
  currency        text default 'USD',
  method          text check (method in ('cash','bank_transfer','credit_card','debit_card','check','paypal','stripe','mercadopago','other')),
  reference       text,
  status          text default 'completed' check (status in ('pending','completed','failed','refunded')),
  payment_date    date default current_date,
  notes           text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);
alter table payments enable row level security;
create policy "Workspace owner manages payments" on payments
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- PURCHASE ORDERS (Purchasing)
-- ============================================================
create table if not exists suppliers (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  address         text,
  tax_id          text,
  payment_terms   text,
  currency        text default 'USD',
  notes           text,
  tags            text[],
  contact_id      uuid references contacts(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table suppliers enable row level security;
create policy "Workspace owner manages suppliers" on suppliers
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists purchase_orders (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  po_number       text not null,
  supplier_id     uuid references suppliers(id) on delete set null,
  status          text default 'draft' check (status in ('draft','sent','confirmed','received','partial','cancelled')),
  currency        text default 'USD',
  subtotal        numeric default 0,
  tax_amount      numeric default 0,
  total           numeric default 0,
  expected_date   date,
  received_at     timestamptz,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table purchase_orders enable row level security;
create policy "Workspace owner manages purchase orders" on purchase_orders
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists purchase_order_items (
  id              uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  description     text not null,
  quantity        numeric default 1,
  unit_cost       numeric default 0,
  total           numeric default 0,
  received_qty    numeric default 0,
  order_index     int default 0
);
alter table purchase_order_items enable row level security;
create policy "PO items follow PO" on purchase_order_items
  using (purchase_order_id in (select id from purchase_orders where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- ACCOUNTING (Chart of Accounts + Journal Entries)
-- ============================================================
create table if not exists chart_of_accounts (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  code            text not null,
  name            text not null,
  type            text not null check (type in ('asset','liability','equity','revenue','expense')),
  subtype         text,
  parent_id       uuid references chart_of_accounts(id) on delete set null,
  is_system       boolean default false,
  balance         numeric default 0,
  currency        text default 'USD',
  active          boolean default true,
  created_at      timestamptz default now(),
  unique(workspace_id, code)
);
alter table chart_of_accounts enable row level security;
create policy "Workspace owner manages accounts" on chart_of_accounts
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists journal_entries (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  entry_number    text not null,
  date            date not null default current_date,
  description     text,
  reference       text,
  source          text,
  status          text default 'draft' check (status in ('draft','posted','voided')),
  total_debit     numeric default 0,
  total_credit    numeric default 0,
  invoice_id      uuid references invoices(id) on delete set null,
  payment_id      uuid references payments(id) on delete set null,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);
alter table journal_entries enable row level security;
create policy "Workspace owner manages journal entries" on journal_entries
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists journal_lines (
  id              uuid primary key default uuid_generate_v4(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id      uuid not null references chart_of_accounts(id) on delete restrict,
  description     text,
  debit           numeric default 0,
  credit          numeric default 0,
  order_index     int default 0
);
alter table journal_lines enable row level security;
create policy "Journal lines follow entry" on journal_lines
  using (journal_entry_id in (select id from journal_entries where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- HR (Employees, Departments, Payroll)
-- ============================================================
create table if not exists departments (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  manager_id      uuid references auth.users(id),
  parent_id       uuid references departments(id) on delete set null,
  created_at      timestamptz default now(),
  unique(workspace_id, name)
);
alter table departments enable row level security;
create policy "Workspace owner manages departments" on departments
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists employees (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid references auth.users(id),
  employee_number text,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  department_id   uuid references departments(id) on delete set null,
  position        text,
  employment_type text default 'full_time' check (employment_type in ('full_time','part_time','contractor','intern')),
  start_date      date,
  end_date        date,
  salary          numeric default 0,
  salary_currency text default 'USD',
  salary_period   text default 'monthly' check (salary_period in ('hourly','daily','weekly','biweekly','monthly','annual')),
  bank_account    text,
  tax_id          text,
  address         text,
  emergency_contact text,
  status          text default 'active' check (status in ('active','inactive','terminated','on_leave')),
  custom_fields   jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table employees enable row level security;
create policy "Workspace owner manages employees" on employees
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create trigger employees_updated_at before update on employees for each row execute function update_updated_at();

create table if not exists leave_requests (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  employee_id     uuid not null references employees(id) on delete cascade,
  type            text not null check (type in ('vacation','sick','personal','maternity','paternity','unpaid','other')),
  start_date      date not null,
  end_date        date not null,
  days            numeric not null,
  status          text default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  approved_by     uuid references auth.users(id),
  notes           text,
  created_at      timestamptz default now()
);
alter table leave_requests enable row level security;
create policy "Workspace owner manages leave requests" on leave_requests
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists payroll_runs (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  period_start    date not null,
  period_end      date not null,
  status          text default 'draft' check (status in ('draft','processing','completed','cancelled')),
  total_gross     numeric default 0,
  total_deductions numeric default 0,
  total_net       numeric default 0,
  employee_count  int default 0,
  processed_at    timestamptz,
  created_at      timestamptz default now()
);
alter table payroll_runs enable row level security;
create policy "Workspace owner manages payroll" on payroll_runs
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

create table if not exists payslips (
  id              uuid primary key default uuid_generate_v4(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  employee_id     uuid not null references employees(id) on delete cascade,
  gross_salary    numeric default 0,
  deductions      jsonb default '[]',
  total_deductions numeric default 0,
  net_salary      numeric default 0,
  payment_method  text,
  payment_status  text default 'pending' check (payment_status in ('pending','paid','failed')),
  paid_at         timestamptz
);
alter table payslips enable row level security;
create policy "Payslips follow payroll" on payslips
  using (payroll_run_id in (select id from payroll_runs where workspace_id in (select id from workspaces where owner_id = auth.uid())));

-- ============================================================
-- RECURRING INVOICES (subscriptions)
-- ============================================================
create table if not exists recurring_invoices (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete set null,
  title           text not null,
  frequency       text not null check (frequency in ('weekly','biweekly','monthly','quarterly','yearly')),
  currency        text default 'USD',
  subtotal        numeric default 0,
  tax_rate        numeric default 0,
  total           numeric default 0,
  next_date       date not null,
  end_date        date,
  items           jsonb default '[]',
  auto_send       boolean default false,
  active          boolean default true,
  invoices_generated int default 0,
  last_generated_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table recurring_invoices enable row level security;
create policy "Workspace owner manages recurring invoices" on recurring_invoices
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));

-- ============================================================
-- AUDIT LOG (activity trail for compliance)
-- ============================================================
create table if not exists audit_log (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid references auth.users(id),
  action          text not null,
  entity_type     text not null,
  entity_id       uuid,
  entity_name     text,
  changes         jsonb default '{}',
  ip_address      text,
  created_at      timestamptz default now()
);
alter table audit_log enable row level security;
create policy "Workspace owner views audit log" on audit_log
  using (workspace_id in (select id from workspaces where owner_id = auth.uid()));
create index if not exists idx_audit_workspace on audit_log(workspace_id, created_at desc);

-- Done! Your FlowCRM database is ready.
