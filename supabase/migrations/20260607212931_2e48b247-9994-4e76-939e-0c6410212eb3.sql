
-- Unschedule pulse cron job if exists
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'pulse%';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop helper function
DROP FUNCTION IF EXISTS public.set_pulse_cron(integer, text);

-- Drop all pulse_* tables (CASCADE handles FKs/policies/grants)
DROP TABLE IF EXISTS public.pulse_user_behavior CASCADE;
DROP TABLE IF EXISTS public.pulse_trending_apps CASCADE;
DROP TABLE IF EXISTS public.pulse_specialty_weights CASCADE;
DROP TABLE IF EXISTS public.pulse_scrape_log CASCADE;
DROP TABLE IF EXISTS public.pulse_raw_snapshots CASCADE;
DROP TABLE IF EXISTS public.pulse_sources CASCADE;
DROP TABLE IF EXISTS public.pulse_metrics CASCADE;
DROP TABLE IF EXISTS public.pulse_app_config CASCADE;
