
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  size_standard text NOT NULL DEFAULT 'US',
  dimension_unit text NOT NULL DEFAULT 'mm',
  default_metal text NOT NULL DEFAULT 'silver',
  default_finish text NOT NULL DEFAULT 'polished',
  default_profile text NOT NULL DEFAULT 'comfort',
  lighting_preset text NOT NULL DEFAULT 'jeweller',
  camera_view text NOT NULL DEFAULT 'front',
  show_measurements boolean NOT NULL DEFAULT false,
  comfort_fit_default boolean NOT NULL DEFAULT true,
  auto_save boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
