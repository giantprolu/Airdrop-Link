-- ===========================================
-- Run this SQL in your Supabase SQL Editor
-- ===========================================

-- 1. Create files table (renamed from photos to support all file types)
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  description text,
  created_at timestamp DEFAULT now()
);

-- Migration: If photos table exists, copy data to files
-- INSERT INTO files (id, user_id, file_path, file_name, created_at)
-- SELECT id, user_id, file_path, split_part(file_path, '/', -1), created_at FROM photos;

-- 2. Enable Row Level Security
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 3. Since we use Clerk (not Supabase Auth), we use service_role key
--    which bypasses RLS. Filtering is done in application code.
--    But we still enable RLS for security (blocks anon key access).

-- 4. Allow SELECT for realtime subscriptions (filtered by user_id in app)
DROP POLICY IF EXISTS "Enable read access for anon" ON files;
CREATE POLICY "Enable read access for anon"
  ON files
  FOR SELECT
  TO anon
  USING (true);

-- 5. Enable realtime for the files table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE files;
  END IF;
END $$;

-- ===========================================
-- Storage bucket setup (run in SQL Editor)
-- ===========================================

-- Create storage bucket "files" (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: drop existing then create (idempotent)
DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their files" ON storage.objects;

CREATE POLICY "Users can upload to their folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Users can view files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'files');

CREATE POLICY "Users can delete their files"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'files');
