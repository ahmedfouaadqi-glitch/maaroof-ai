-- Add username column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Add validation: length 3-32, lowercase alphanumeric + - _
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR (length(username) BETWEEN 3 AND 32 AND username ~ '^[a-z0-9_-]+$'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (username) WHERE username IS NOT NULL;

-- Helper: generate a slug from email
CREATE OR REPLACE FUNCTION public.generate_username_from_email(_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  base := regexp_replace(lower(split_part(coalesce(_email, ''), '@', 1)), '[^a-z0-9_-]+', '-', 'g');
  base := regexp_replace(base, '^-+|-+$', '', 'g');
  IF base IS NULL OR length(base) < 3 THEN
    base := 'user-' || substr(md5(coalesce(_email, random()::text)), 1, 6);
  END IF;
  IF length(base) > 28 THEN
    base := substr(base, 1, 28);
  END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := substr(base, 1, 28) || '-' || suffix::text;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Backfill usernames for existing rows
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, email FROM public.profiles WHERE username IS NULL LOOP
    UPDATE public.profiles
      SET username = public.generate_username_from_email(r.email)
      WHERE id = r.id;
  END LOOP;
END $$;

-- Update handle_new_user to set username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    public.generate_username_from_email(NEW.email)
  );

  IF lower(NEW.email) = 'ahmedfouaad.qi@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;