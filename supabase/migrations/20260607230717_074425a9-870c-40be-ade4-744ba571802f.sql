
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS agent_daily_cap integer,
  ADD COLUMN IF NOT EXISTS agent_monthly_cap integer,
  ADD COLUMN IF NOT EXISTS agent_max_targets integer;

-- Best-effort backfill from legacy agent_addons by name matching (Trial, Pro, etc.)
UPDATE public.subscription_plans p
   SET agent_daily_cap   = COALESCE(p.agent_daily_cap,   a.daily_task_cap),
       agent_monthly_cap = COALESCE(p.agent_monthly_cap, a.monthly_tasks),
       agent_max_targets = COALESCE(p.agent_max_targets, a.max_targets)
  FROM public.agent_addons a
 WHERE lower(a.name) = lower(p.name);
