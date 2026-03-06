
-- Access codes table
CREATE TABLE public.access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium', 'export')),
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read codes (to validate them)
CREATE POLICY "Authenticated users can read active codes"
  ON public.access_codes FOR SELECT TO authenticated
  USING (active = true);

-- User access grants table
CREATE TABLE public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_id UUID NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_id)
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access"
  ON public.user_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own access"
  ON public.user_access FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to redeem an access code atomically
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_row access_codes%ROWTYPE;
  v_user_id UUID;
  v_tier TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_code_row FROM access_codes WHERE code = UPPER(TRIM(p_code)) AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired access code');
  END IF;

  IF v_code_row.max_uses IS NOT NULL AND v_code_row.current_uses >= v_code_row.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This code has reached its usage limit');
  END IF;

  -- Check if already redeemed
  IF EXISTS (SELECT 1 FROM user_access WHERE user_id = v_user_id AND code_id = v_code_row.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this code');
  END IF;

  -- Grant access
  INSERT INTO user_access (user_id, code_id, tier) VALUES (v_user_id, v_code_row.id, v_code_row.tier);
  UPDATE access_codes SET current_uses = current_uses + 1 WHERE id = v_code_row.id;

  RETURN jsonb_build_object('success', true, 'tier', v_code_row.tier);
END;
$$;

-- Seed some default codes
INSERT INTO public.access_codes (code, tier, max_uses) VALUES
  ('GALAXYFREE', 'free', NULL),
  ('FORGEPREMIUM', 'premium', 100),
  ('EXPORTPRO', 'export', 50);
