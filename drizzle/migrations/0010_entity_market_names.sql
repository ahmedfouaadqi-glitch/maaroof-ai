CREATE TABLE public.entity_market_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text NOT NULL,
  name text NOT NULL,
  lang text NOT NULL DEFAULT 'ar',
  kind text NOT NULL DEFAULT 'official',
  evidence_url text,
  status text NOT NULL DEFAULT 'unconfirmed',
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, country_code, lang, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_market_names TO authenticated;
GRANT ALL ON public.entity_market_names TO service_role;
ALTER TABLE public.entity_market_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own market names" ON public.entity_market_names FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.guard_market_name_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Users may only mark "owner_confirmed" or "unconfirmed"; "evidence_confirmed" is server-only.
  IF auth.role() = 'authenticated' THEN
    IF NEW.status NOT IN ('unconfirmed','owner_confirmed') THEN
      IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN NULL;
      ELSE NEW.status := 'unconfirmed'; END IF;
    END IF;
    NEW.verified_by := CASE WHEN NEW.status = 'owner_confirmed' THEN 'owner'
      WHEN TG_OP = 'UPDATE' THEN OLD.verified_by ELSE NULL END;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_market_name BEFORE INSERT OR UPDATE ON public.entity_market_names
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_name_status();