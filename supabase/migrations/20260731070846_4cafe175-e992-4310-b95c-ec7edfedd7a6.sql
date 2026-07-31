-- Helper: workspace membership without recursive RLS
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _workspace_id IS NOT NULL AND _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = _workspace_id AND w.owner_id = _user_id)
  )
$$;

-- benchmarks: owner / workspace member / admin only
DROP POLICY IF EXISTS benchmarks_read ON public.benchmarks;
CREATE POLICY benchmarks_read ON public.benchmarks
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_workspace_member(workspace_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- benchmark_results: owner / parent benchmark visibility / admin only
DROP POLICY IF EXISTS benchmark_results_read ON public.benchmark_results;
CREATE POLICY benchmark_results_read ON public.benchmark_results
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.benchmarks b
    WHERE b.id = benchmark_results.benchmark_id
      AND (b.user_id = auth.uid() OR public.is_workspace_member(b.workspace_id, auth.uid()))
  )
);

-- trust_profiles: global rows must carry no user/workspace attribution
DROP POLICY IF EXISTS trust_profiles_read ON public.trust_profiles;
CREATE POLICY trust_profiles_read ON public.trust_profiles
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (scope = 'global' AND user_id IS NULL AND workspace_id IS NULL)
  OR public.is_workspace_member(workspace_id, auth.uid())
);