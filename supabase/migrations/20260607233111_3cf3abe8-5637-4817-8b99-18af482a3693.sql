
ALTER TABLE public.publish_channels
  ADD COLUMN IF NOT EXISTS connection_id text,
  ADD COLUMN IF NOT EXISTS account_label text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_notify_channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS notify_onboarded boolean NOT NULL DEFAULT false;
