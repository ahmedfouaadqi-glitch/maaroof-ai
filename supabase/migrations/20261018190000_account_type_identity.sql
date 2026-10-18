-- Canonical account classification for Maaroof identity.
-- Account type is descriptive context, not an authorization/role grant.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_type_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_type_check
      CHECK (account_type IN (
        'individual',
        'creator',
        'business',
        'ecommerce',
        'agency',
        'nonprofit',
        'public_sector'
      ));
  END IF;
END $$;
