ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS probability int DEFAULT 50;
NOTIFY pgrst, 'reload schema';
