-- Remove profiles from realtime publication to prevent broadcast of profile changes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles';
  END IF;
END $$;

-- Restrict app_settings SELECT to admins only
DROP POLICY IF EXISTS "authenticated view settings" ON public.app_settings;