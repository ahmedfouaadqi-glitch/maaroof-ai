
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_devices integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS extra_device_fee_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_fingerprints jsonb NOT NULL DEFAULT '[]'::jsonb;
