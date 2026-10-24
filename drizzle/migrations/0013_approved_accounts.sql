CREATE TABLE public.approved_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_accounts TO authenticated;
GRANT ALL ON public.approved_accounts TO service_role;
ALTER TABLE public.approved_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage approved accounts" ON public.approved_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.approved_accounts (email) VALUES ('jointmediahouselb@gmail.com'), ('mjlailaty@gmail.com');