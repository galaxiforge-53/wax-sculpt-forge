
-- Table for shared ring templates with short codes
CREATE TABLE public.shared_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text UNIQUE NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Shared Design',
  design_package jsonb NOT NULL,
  thumbnail text,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by share_code
CREATE INDEX idx_shared_templates_share_code ON public.shared_templates (share_code);

-- Enable RLS
ALTER TABLE public.shared_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read shared templates (public links)
CREATE POLICY "Anyone can view shared templates"
  ON public.shared_templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can create shared templates
CREATE POLICY "Users can create shared templates"
  ON public.shared_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shared templates
CREATE POLICY "Users can delete own shared templates"
  ON public.shared_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_share_views(p_share_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE shared_templates SET view_count = view_count + 1 WHERE share_code = p_share_code;
$$;
