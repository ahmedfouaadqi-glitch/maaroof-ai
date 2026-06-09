-- Multi-currency support for plans, addons, and per-tool pricing.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.agent_addons
  ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'IQD';

ALTER TABLE public.tool_plan_access
  ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'USD';

-- Backfill from legacy columns.
UPDATE public.subscription_plans
SET prices = jsonb_strip_nulls(jsonb_build_object(
  'USD', NULLIF(price_usd, 0),
  'IQD', NULLIF(price_iqd, 0)
))
WHERE prices = '{}'::jsonb;

UPDATE public.subscription_plans
SET default_currency = CASE
  WHEN COALESCE(price_usd, 0) > 0 THEN 'USD'
  WHEN COALESCE(price_iqd, 0) > 0 THEN 'IQD'
  ELSE 'USD'
END
WHERE default_currency = 'USD' AND prices <> '{}'::jsonb;

UPDATE public.agent_addons
SET prices = jsonb_strip_nulls(jsonb_build_object('IQD', NULLIF(price_iqd, 0)))
WHERE prices = '{}'::jsonb;

UPDATE public.tool_plan_access
SET prices = jsonb_strip_nulls(jsonb_build_object('USD', NULLIF(usd_per_use, 0)))
WHERE prices = '{}'::jsonb;

-- Country -> currency reference table (public read).
CREATE TABLE IF NOT EXISTS public.country_currency (
  country_code text PRIMARY KEY,
  currency text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.country_currency TO anon, authenticated;
GRANT ALL ON public.country_currency TO service_role;

ALTER TABLE public.country_currency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "country_currency public read" ON public.country_currency;
CREATE POLICY "country_currency public read" ON public.country_currency
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "country_currency admin write" ON public.country_currency;
CREATE POLICY "country_currency admin write" ON public.country_currency
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.country_currency (country_code, currency) VALUES
  ('IQ','IQD'),('SA','SAR'),('AE','AED'),('EG','EGP'),('JO','JOD'),('KW','KWD'),
  ('QA','QAR'),('BH','BHD'),('OM','OMR'),('LB','LBP'),('SY','SYP'),('YE','YER'),
  ('PS','ILS'),('MA','MAD'),('DZ','DZD'),('TN','TND'),('LY','LYD'),('SD','SDG'),
  ('TR','TRY'),('GB','GBP'),('US','USD'),('CA','CAD'),('AU','AUD'),('DE','EUR'),
  ('FR','EUR'),('IT','EUR'),('ES','EUR'),('NL','EUR'),('IR','IRR'),('PK','PKR'),
  ('IN','INR')
ON CONFLICT (country_code) DO NOTHING;