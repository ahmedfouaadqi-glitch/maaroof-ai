-- Kill switch: disable pulse system entirely
INSERT INTO public.pulse_app_config (key, value)
VALUES ('pulse_enabled', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '{"enabled": false}'::jsonb;

INSERT INTO public.pulse_app_config (key, value)
VALUES ('pulse_cron_hours', '{"hours": 0}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '{"hours": 0}'::jsonb;

-- Deactivate all sources so even ad-hoc runs do nothing
UPDATE public.pulse_sources SET active = false;

-- Unschedule any pulse cron jobs
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname LIKE 'pulse-crawl%' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END$$;