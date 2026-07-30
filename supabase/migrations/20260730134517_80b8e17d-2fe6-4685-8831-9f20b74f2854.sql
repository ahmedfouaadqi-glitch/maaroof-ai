ALTER TABLE public.maaroof_runs ADD COLUMN IF NOT EXISTS compliance jsonb;

CREATE OR REPLACE VIEW public.law_compliance_v
WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', r.created_at)::date AS day,
  (v ->> 'id')::int                     AS law_id,
  v ->> 'key'                           AS law_key,
  v ->> 'ar'                            AS law_ar,
  v ->> 'severity'                      AS severity,
  count(*)                              AS violations
FROM public.maaroof_runs r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.compliance -> 'violations', '[]'::jsonb)) AS v
GROUP BY 1,2,3,4,5;

GRANT SELECT ON public.law_compliance_v TO authenticated;
GRANT SELECT ON public.law_compliance_v TO service_role;