ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_visibility jsonb NOT NULL DEFAULT '{}'::jsonb;