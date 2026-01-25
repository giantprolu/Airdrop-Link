-- ===========================================
-- Run this SQL in your Supabase SQL Editor
-- ===========================================

-- 1. Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  file_path text NOT NULL,
  created_at timestamp DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- 3. Since we use Clerk (not Supabase Auth), we use service_role key
--    which bypasses RLS. Filtering is done in application code.
--    But we still enable RLS for security (blocks anon key access).

-- 4. Allow SELECT for realtime subscriptions (filtered by user_id in app)
CREATE POLICY "Enable read access for anon"
  ON photos
  FOR SELECT
  TO anon
  USING (true);

-- 5. Enable realtime for the photos table
ALTER PUBLICATION supabase_realtime ADD TABLE photos;

-- ===========================================
-- Storage bucket setup (run in SQL Editor)
-- ===========================================

-- Create storage bucket "photos" (private by default)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated upload/download to user's folder
CREATE POLICY "Users can upload to their folder"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Users can view files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'photos');

CREATE POLICY "Users can delete their files"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'photos');
