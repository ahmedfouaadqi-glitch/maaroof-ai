-- Persist the user's preferred default interview persona separately from verified entity identity.
-- This is a profile preference only; it does not change entity_type or any model/provider integration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interview_persona text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_interview_persona_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_interview_persona_check
      CHECK (
        interview_persona IS NULL
        OR interview_persona IN ('individual', 'creator', 'company', 'agency')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.interview_persona IS
  'Preferred default target for new Maaroof context interviews; separate from verified entity_type.';
