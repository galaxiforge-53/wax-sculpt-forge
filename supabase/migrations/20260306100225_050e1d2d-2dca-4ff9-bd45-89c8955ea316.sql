
-- Update redeem_access_code to also grant admin role when tier = 'admin'
CREATE OR REPLACE FUNCTION public.redeem_access_code(p_code text)
 RETURNS jsonb
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

  -- If tier is admin, also grant admin role
  IF v_code_row.tier = 'admin' THEN
    INSERT INTO user_roles (user_id, role) VALUES (v_user_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'tier', v_code_row.tier);
END;
$$;
