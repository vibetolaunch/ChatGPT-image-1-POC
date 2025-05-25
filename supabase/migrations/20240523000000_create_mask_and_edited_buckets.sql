-- Create masks bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('masks', 'masks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create edited-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('edited-images', 'edited-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies for masks bucket if they exist
DROP POLICY IF EXISTS "Users can upload their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own masks" ON storage.objects;
DROP POLICY IF EXISTS "Public can view masks" ON storage.objects;

-- Drop existing policies for edited-images bucket if they exist
DROP POLICY IF EXISTS "Users can upload their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own edited images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view edited images" ON storage.objects;

-- Create storage policies for masks bucket
CREATE POLICY "Users can upload their own masks"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'masks' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

CREATE POLICY "Users can view their own masks"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'masks' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

CREATE POLICY "Users can delete their own masks"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'masks' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

-- Allow public access to view masks (since bucket is public)
CREATE POLICY "Public can view masks"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'masks');

-- Create storage policies for edited-images bucket
CREATE POLICY "Users can upload their own edited images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'edited-images' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

CREATE POLICY "Users can view their own edited images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'edited-images' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

CREATE POLICY "Users can delete their own edited images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'edited-images' AND
    auth.uid()::text = (string_to_array(name, '-'))[1]
  );

-- Allow public access to view edited images (since bucket is public)
CREATE POLICY "Public can view edited images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'edited-images');
