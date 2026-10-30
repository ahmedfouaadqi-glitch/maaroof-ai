-- Compatibility copy of supabase/scripts/brand-boost-cron-setup.sql.
-- Keep this file synchronized with the canonical setup script.
-- Run after applying the Brand Boost migrations and configuring server environment variables.
-- Replace both placeholders before running. Never commit real secrets.

do $$
declare app_url_id uuid; scheduler_secret_id uuid;
begin
  select id into app_url_id from vault.secrets where name = 'maaroof_app_base_url' limit 1;
  if app_url_id is null then
    perform vault.create_secret('https://YOUR-MAAROOF-APP-DOMAIN', 'maaroof_app_base_url');
  else
    perform vault.update_secret(app_url_id, 'https://YOUR-MAAROOF-APP-DOMAIN', 'maaroof_app_base_url', 'Brand Boost scheduler public app base URL');
  end if;

  select id into scheduler_secret_id from vault.secrets where name = 'brand_boost_scheduler_secret' limit 1;
  if scheduler_secret_id is null then
    perform vault.create_secret('REPLACE_WITH_A_LONG_RANDOM_SECRET', 'brand_boost_scheduler_secret');
  else
    perform vault.update_secret(scheduler_secret_id, 'REPLACE_WITH_A_LONG_RANDOM_SECRET', 'brand_boost_scheduler_secret', 'Brand Boost scheduler shared secret');
  end if;
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'maaroof-brand-boost-scheduler';

select cron.schedule(
  'maaroof-brand-boost-scheduler',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'maaroof_app_base_url'
      limit 1
    ) || '/api/brand-boost-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'brand_boost_scheduler_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $job$
);
