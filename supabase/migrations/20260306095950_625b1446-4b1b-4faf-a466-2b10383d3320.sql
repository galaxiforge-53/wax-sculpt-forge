
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table (proper role management, NOT on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Create approved_emails table (GalaxiForge sync)
CREATE TABLE public.approved_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  source TEXT NOT NULL DEFAULT 'manual',
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.approved_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage approved emails"
  ON public.approved_emails FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Admin can view all access codes
CREATE POLICY "Admins can manage access codes"
  ON public.access_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Admin can view all user_access records
CREATE POLICY "Admins can view all user access"
  ON public.user_access FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Admin can view all ring_designs
CREATE POLICY "Admins can view all designs"
  ON public.ring_designs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 10. Function to auto-grant access on signup based on approved_emails
CREATE OR REPLACE FUNCTION public.handle_email_auto_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved approved_emails%ROWTYPE;
  v_code_id UUID;
BEGIN
  -- Check if the new user's email is in approved_emails
  SELECT * INTO v_approved
  FROM approved_emails
  WHERE LOWER(email) = LOWER(NEW.email);

  IF FOUND THEN
    -- Create or find a system access code for email-based grants
    SELECT id INTO v_code_id
    FROM access_codes
    WHERE code = 'EMAIL-AUTO-GRANT' AND active = true;

    IF v_code_id IS NULL THEN
      INSERT INTO access_codes (code, tier, active, max_uses)
      VALUES ('EMAIL-AUTO-GRANT', v_approved.tier, true, NULL)
      RETURNING id INTO v_code_id;
    END IF;

    -- Grant access
    INSERT INTO user_access (user_id, code_id, tier)
    VALUES (NEW.id, v_code_id, v_approved.tier)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 11. Trigger: after profile is created (which happens after signup), check email
CREATE TRIGGER on_profile_created_check_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_auto_grant();
