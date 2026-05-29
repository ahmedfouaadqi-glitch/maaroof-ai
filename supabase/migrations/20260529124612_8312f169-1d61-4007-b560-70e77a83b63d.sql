CREATE OR REPLACE FUNCTION public.set_pulse_cron(_hours int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_url text := 'https://project--fa07a113-c24f-4419-b1d8-07ffd60e98c6.lovable.app/api/public/hooks/pulse-crawl';
  v_anon text;
  v_schedule text;
  v_body text;
BEGIN
  -- Remove any existing pulse cron jobs (try common names)
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname LIKE 'pulse-crawl%';

  IF _hours IS NULL OR _hours <= 0 THEN
    RETURN 'unscheduled';
  END IF;

  IF _hours NOT IN (1,2,3,4,6,8,12,24) THEN
    RAISE EXCEPTION 'hours must be one of 1,2,3,4,6,8,12,24';
  END IF;

  SELECT value->>'key' INTO v_anon FROM public.pulse_app_config WHERE key = 'anon_key' LIMIT 1;
  -- fallback: pull from current_setting if you stored it elsewhere; otherwise expect header from hook caller
  v_anon := COALESCE(v_anon, current_setting('app.anon_key', true));

  v_schedule := format('0 */%s * * *', _hours);
  v_body := format(
    $cron$select net.http_post(
      url:=%L,
      headers:=jsonb_build_object('Content-Type','application/json','apikey', %L),
      body:='{}'::jsonb
    ) as request_id;$cron$,
    v_url, COALESCE(v_anon,'')
  );

  PERFORM cron.schedule('pulse-crawl', v_schedule, v_body);
  RETURN v_schedule;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_pulse_cron(int) TO service_role;
REVOKE EXECUTE ON FUNCTION public.set_pulse_cron(int) FROM PUBLIC, anon, authenticated;