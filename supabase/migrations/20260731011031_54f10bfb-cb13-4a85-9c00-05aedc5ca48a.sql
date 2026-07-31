CREATE OR REPLACE FUNCTION public.guard_profile_specialty_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.specialty IS DISTINCT FROM OLD.specialty THEN
    RAISE EXCEPTION 'Specialty changes require administrator approval';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_specialty_change_trg ON public.profiles;
CREATE TRIGGER guard_profile_specialty_change_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_specialty_change();

CREATE TABLE IF NOT EXISTS public.specialty_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  current_specialty text,
  requested_specialty text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.specialty_change_requests TO authenticated;
GRANT ALL ON public.specialty_change_requests TO service_role;

ALTER TABLE public.specialty_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own specialty requests" ON public.specialty_change_requests;
CREATE POLICY "users view own specialty requests"
ON public.specialty_change_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "users create own specialty requests" ON public.specialty_change_requests;
CREATE POLICY "users create own specialty requests"
ON public.specialty_change_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS specialty_requests_one_pending
ON public.specialty_change_requests (user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS specialty_requests_status_idx
ON public.specialty_change_requests (status, created_at DESC);

DROP TRIGGER IF EXISTS touch_specialty_change_requests ON public.specialty_change_requests;
CREATE TRIGGER touch_specialty_change_requests
BEFORE UPDATE ON public.specialty_change_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();