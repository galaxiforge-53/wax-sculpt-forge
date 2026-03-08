
-- Design version history table
CREATE TABLE public.design_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  design_id UUID NOT NULL REFERENCES public.ring_designs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  design_package JSONB NOT NULL,
  thumbnail TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(design_id, version_number)
);

-- Enable RLS
ALTER TABLE public.design_versions ENABLE ROW LEVEL SECURITY;

-- Users can view own versions
CREATE POLICY "Users can view own versions"
  ON public.design_versions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert own versions
CREATE POLICY "Users can insert own versions"
  ON public.design_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete own versions
CREATE POLICY "Users can delete own versions"
  ON public.design_versions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all versions
CREATE POLICY "Admins can view all versions"
  ON public.design_versions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
