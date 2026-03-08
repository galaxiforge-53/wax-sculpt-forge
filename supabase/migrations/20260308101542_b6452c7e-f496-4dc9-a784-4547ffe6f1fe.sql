
-- Add columns to production_orders for STL and preview asset URLs
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS stl_path TEXT,
  ADD COLUMN IF NOT EXISTS preview_urls JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for production assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'production-assets',
  'production-assets',
  false,
  52428800,
  ARRAY['application/octet-stream', 'model/stl', 'image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users can upload own production assets"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'production-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own production assets
CREATE POLICY "Users can read own production assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'production-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins can read all production assets
CREATE POLICY "Admins can read all production assets"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'production-assets'
    AND public.has_role(auth.uid(), 'admin')
  );
