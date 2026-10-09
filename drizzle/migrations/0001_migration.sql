ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS entity_updated_at timestamptz;

CREATE TABLE public.entity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  field text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entity_history_user_idx ON public.entity_history(user_id, changed_at DESC);
ALTER TABLE public.entity_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.entity_history TO authenticated;
GRANT ALL ON public.entity_history TO service_role;
CREATE POLICY "owner reads own entity history" ON public.entity_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_entity_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed boolean := false;
BEGIN
  IF NEW.entity_type IS DISTINCT FROM OLD.entity_type THEN
    INSERT INTO entity_history(user_id, field, old_value, new_value) VALUES (NEW.id, 'entity_type', to_jsonb(OLD.entity_type), to_jsonb(NEW.entity_type)); changed := true; END IF;
  IF NEW.hq_country IS DISTINCT FROM OLD.hq_country THEN
    INSERT INTO entity_history(user_id, field, old_value, new_value) VALUES (NEW.id, 'hq_country', to_jsonb(OLD.hq_country), to_jsonb(NEW.hq_country)); changed := true; END IF;
  IF NEW.target_markets IS DISTINCT FROM OLD.target_markets THEN
    INSERT INTO entity_history(user_id, field, old_value, new_value) VALUES (NEW.id, 'target_markets', to_jsonb(OLD.target_markets), to_jsonb(NEW.target_markets)); changed := true; END IF;
  IF NEW.specialty_scope IS DISTINCT FROM OLD.specialty_scope THEN
    INSERT INTO entity_history(user_id, field, old_value, new_value) VALUES (NEW.id, 'specialty_scope', to_jsonb(OLD.specialty_scope), to_jsonb(NEW.specialty_scope)); changed := true; END IF;
  IF NEW.entity_links IS DISTINCT FROM OLD.entity_links THEN
    INSERT INTO entity_history(user_id, field, old_value, new_value) VALUES (NEW.id, 'entity_links', to_jsonb(OLD.entity_links), to_jsonb(NEW.entity_links)); changed := true; END IF;
  IF changed THEN NEW.entity_updated_at := now(); END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_entity_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_entity_history BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_entity_history();