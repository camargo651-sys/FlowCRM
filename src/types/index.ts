export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbRow = Record<string, any>

// --- WORKSPACE ---
export interface Workspace {
  id: string
  name: string
  slug: string
  plan: 'free' | 'starter' | 'growth' | 'scale'
  owner_id: string
  logo_url?: string
  primary_color?: string
  created_at: string
}

// --- USER ---
export interface Profile {
  id: string
  workspace_id: string
  full_name: string
  email: string
  avatar_url?: string
  role: 'admin' | 'manager' | 'member'
  created_at: string
}

// --- PIPELINE ---
export interface Pipeline {
  id: string
  workspace_id: string
  name: string
  description?: string
  color: string
  order_index: number
  created_at: string
}

export interface PipelineStage {
  id: string
  pipeline_id: string
  workspace_id: string
  name: string
  order_index: number
  color: string
  win_stage: boolean
  lost_stage: boolean
  is_won?: boolean
  is_lost?: boolean
  required_fields?: string[]
  created_at: string
}

// --- CONTACT ---
export interface Contact {
  id: string
  workspace_id: string
  type: 'person' | 'company'
  name: string
  email?: string
  phone?: string
  company_name?: string
  company_id?: string
  job_title?: string
  website?: string
  address?: string
  tags?: string[]
  notes?: string
  custom_fields?: Json
  owner_id?: string
  engagement_score?: number
  score_label?: string
  last_interaction_at?: string
  interaction_count?: number
  social_profiles?: { instagram?: string; linkedin?: string; facebook?: string; tiktok?: string }
  created_at: string
  updated_at: string
}

// --- DEAL ---
export interface Deal {
  id: string
  workspace_id: string
  pipeline_id: string
  stage_id: string
  title: string
  value?: number
  currency: string
  contact_id?: string
  company_id?: string
  owner_id?: string
  probability?: number
  expected_close_date?: string
  status: 'open' | 'won' | 'lost'
  lost_reason?: string
  notes?: string
  tags?: string[]
  custom_fields?: Json
  order_index: number
  created_at: string
  updated_at: string
}

// --- ACTIVITY ---
export interface Activity {
  id: string
  workspace_id: string
  type: 'call' | 'email' | 'meeting' | 'note' | 'task'
  title: string
  notes?: string
  deal_id?: string
  contact_id?: string
  owner_id?: string
  due_date?: string
  done: boolean
  created_at: string
  updated_at: string
}

// --- CUSTOM FIELD DEFINITION ---
export interface CustomFieldDef {
  id: string
  workspace_id: string
  entity: 'deal' | 'contact' | 'company'
  label: string
  key: string
  type: 'text' | 'number' | 'currency' | 'date' | 'select' | 'boolean' | 'url'
  options?: string[]
  required: boolean
  order_index: number
  created_at: string
}

// --- UI HELPERS ---
export interface KanbanDeal extends Deal {
  contact?: Pick<Contact, 'id' | 'name' | 'email'>
  owner?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>
  activities_count?: number
}

export interface DashboardStats {
  open_deals: number
  total_value: number
  won_this_month: number
  won_value_this_month: number
  activities_due: number
  conversion_rate: number
}
