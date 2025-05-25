-- Drop existing policies for masks bucket
DROP POLICY IF EXISTS "Users can upload their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Public can view masks" ON storage.objects;

-- Drop existing policies for edited-images bucket
DROP POLICY IF EXISTS "Users can upload their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view edited images" ON storage.objects;

-- Create corrected storage policies for masks bucket
-- File format: {user_id}-mask-{timestamp}.png
CREATE POLICY "Users can upload their own masks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'masks' AND
    auth.uid()::text = split_part(name, '-mask-', 1)
  );

CREATE POLICY "Users can view their own masks"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'masks' AND
    auth.uid()::text = split_part(name, '-mask-', 1)
  );

CREATE POLICY "Users can delete their own masks"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'masks' AND
    auth.uid()::text = split_part(name, '-mask-', 1)
  );

-- Allow public access to view masks (since bucket is public)
CREATE POLICY "Public can view masks"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'masks');

-- Create corrected storage policies for edited-images bucket
-- File format: {user_id}-result-{timestamp}.png
CREATE POLICY "Users can upload their own edited images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'edited-images' AND
    auth.uid()::text = split_part(name, '-result-', 1)
  );

CREATE POLICY "Users can view their own edited images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'edited-images' AND
    auth.uid()::text = split_part(name, '-result-', 1)
  );

CREATE POLICY "Users can delete their own edited images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'edited-images' AND
    auth.uid()::text = split_part(name, '-result-', 1)
  );

-- Allow public access to view edited images (since bucket is public)
CREATE POLICY "Public can view edited images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'edited-images');
