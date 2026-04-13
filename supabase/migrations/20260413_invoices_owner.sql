-- Add owner_id to invoices so record-change notifications can target the owner
-- Created: 2026-04-13

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_owner_id ON invoices(owner_id);
