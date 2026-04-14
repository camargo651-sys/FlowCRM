-- Visual block editor: store the block tree alongside generated HTML so the
-- user never needs to edit markup again. HTML columns stay as the render
-- artifact for legacy consumers; body_blocks is the source of truth.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS body_blocks jsonb;
ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS body_blocks jsonb;
NOTIFY pgrst, 'reload schema';
