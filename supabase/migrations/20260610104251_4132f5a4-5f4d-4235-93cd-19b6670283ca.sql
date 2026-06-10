ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS discount_badge_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_badge_text text;