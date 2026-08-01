ALTER TABLE public.publish_channels
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token_ciphertext text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

DO $$ BEGIN
  ALTER TABLE public.publish_channels
    ADD CONSTRAINT publish_channels_owner_type_chk
    CHECK (owner_type IN ('personal','organization','brand'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing rows: personal accounts, default for their platform.
UPDATE public.publish_channels SET owner_type = 'personal' WHERE owner_type IS NULL;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, kind ORDER BY created_at DESC) AS rn
  FROM public.publish_channels
)
UPDATE public.publish_channels c
SET is_default = true
FROM ranked r
WHERE c.id = r.id AND r.rn = 1;

-- One default channel per (user, platform); multiple accounts otherwise allowed.
CREATE UNIQUE INDEX IF NOT EXISTS publish_channels_one_default_per_kind
  ON public.publish_channels (user_id, kind) WHERE is_default;

CREATE INDEX IF NOT EXISTS publish_channels_user_kind_idx
  ON public.publish_channels (user_id, kind);

-- Short-lived OAuth linking sessions (service-managed only).
CREATE TABLE IF NOT EXISTS public.oauth_link_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  code_verifier text,
  redirect_uri text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_link_states TO service_role;
ALTER TABLE public.oauth_link_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to oauth_link_states" ON public.oauth_link_states;
CREATE POLICY "No client access to oauth_link_states"
  ON public.oauth_link_states FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS oauth_link_states_expires_idx ON public.oauth_link_states (expires_at);