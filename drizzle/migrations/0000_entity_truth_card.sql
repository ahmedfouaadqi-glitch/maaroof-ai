ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS hq_country text,
  ADD COLUMN IF NOT EXISTS target_markets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specialty_scope text,
  ADD COLUMN IF NOT EXISTS entity_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS entity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS entity_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entity_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS entity_unlock_granted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_entity_card()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.entity_verified_at IS DISTINCT FROM OLD.entity_verified_at
     OR NEW.entity_locked IS DISTINCT FROM OLD.entity_locked
     OR NEW.entity_facts IS DISTINCT FROM OLD.entity_facts
     OR NEW.entity_unlock_granted IS DISTINCT FROM OLD.entity_unlock_granted THEN
    RAISE EXCEPTION 'Not allowed to modify entity verification fields';
  END IF;
  IF OLD.entity_locked AND (
       NEW.entity_type IS DISTINCT FROM OLD.entity_type
    OR NEW.hq_country IS DISTINCT FROM OLD.hq_country
    OR NEW.target_markets IS DISTINCT FROM OLD.target_markets
    OR NEW.specialty_scope IS DISTINCT FROM OLD.specialty_scope
    OR NEW.entity_links IS DISTINCT FROM OLD.entity_links) THEN
    RAISE EXCEPTION 'Entity card is locked; request re-verification';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_profile_entity_card_trg ON public.profiles;
CREATE TRIGGER guard_profile_entity_card_trg BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_entity_card();