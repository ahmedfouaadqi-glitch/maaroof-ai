-- Supabase Cron setup for the Maaroof application HTTP scheduler.
-- Run once in the Supabase SQL Editor AFTER applying 20261030170000_brand_boost_automation.sql.
-- This script expects two secrets in Supabase Vault:
--   maaroof_app_base_url                  e.g. https://maaroofai.com
--   maaroof_brand_boost_scheduler_secret  same value as server env BRAND_BOOST_SCHEDULER_SECRET
--
-- Create the secrets first (replace the sample values):
-- select vault.create_secret('https://YOUR-MAAROOF-APP-DOMAIN', 'maaroof_app_base_url');
-- select vault.create_secret('PASTE_A_RANDOM_32_BYTE_HEX_SECRET', 'maaroof_brand_boost_scheduler_secret');
--
-- Configure the same random secret in the app runtime as BRAND_BOOST_SCHEDULER_SECRET.
-- Configure RESEND_API_KEY and BRAND_BOOST_REPORT_FROM in the app runtime for email delivery.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = 'maaroof-brand-boost-scheduler';

select cron.schedule(
  'maaroof-brand-boost-scheduler',
  '*/15 * * * *',
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
          where name = 'maaroof_brand_boost_scheduler_secret'
          limit 1
        )
      ),
      body := jsonb_build_object('trigger', 'supabase-cron'),
      timeout_milliseconds := 300000
    )
    where exists (
      select 1 from vault.decrypted_secrets where name = 'maaroof_app_base_url'
    )
    and exists (
      select 1 from vault.decrypted_secrets where name = 'maaroof_brand_boost_scheduler_secret'
    );
  $job$
);
