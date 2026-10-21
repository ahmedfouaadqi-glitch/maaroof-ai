CREATE TABLE public.browser_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domains text[] NOT NULL DEFAULT '{}',
  purpose text,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.browser_grants TO authenticated;
GRANT ALL ON public.browser_grants TO service_role;
ALTER TABLE public.browser_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own grants read" ON public.browser_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.browser_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.browser_grants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  instruction text,
  url text NOT NULL,
  status text NOT NULL,
  title text,
  excerpt text,
  links_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.browser_steps TO authenticated;
GRANT ALL ON public.browser_steps TO service_role;
ALTER TABLE public.browser_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own steps read" ON public.browser_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX browser_steps_grant_idx ON public.browser_steps(grant_id, created_at);