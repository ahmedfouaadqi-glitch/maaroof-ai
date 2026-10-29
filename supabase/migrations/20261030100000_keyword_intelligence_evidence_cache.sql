-- Workspace-isolated cache for external evidence used by Keyword Intelligence.
-- Cache rows are scoped by user + workspace and expire after a bounded period.
create table if not exists public.keyword_intelligence_evidence_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  scope_key text not null,
  evidence_type text not null,
  evidence_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint keyword_intelligence_evidence_cache_scope_unique
    unique (user_id, scope_key, evidence_type, evidence_key)
);

create index if not exists keyword_intelligence_evidence_cache_expiry_idx
  on public.keyword_intelligence_evidence_cache (expires_at);
create index if not exists keyword_intelligence_evidence_cache_workspace_idx
  on public.keyword_intelligence_evidence_cache (user_id, workspace_id, evidence_type);

alter table public.keyword_intelligence_evidence_cache enable row level security;

drop policy if exists "Users can read their keyword evidence cache" on public.keyword_intelligence_evidence_cache;
create policy "Users can read their keyword evidence cache"
  on public.keyword_intelligence_evidence_cache for select
  using (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces w
        where w.id = keyword_intelligence_evidence_cache.workspace_id
          and w.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can insert their keyword evidence cache" on public.keyword_intelligence_evidence_cache;
create policy "Users can insert their keyword evidence cache"
  on public.keyword_intelligence_evidence_cache for insert
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces w
        where w.id = keyword_intelligence_evidence_cache.workspace_id
          and w.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update their keyword evidence cache" on public.keyword_intelligence_evidence_cache;
create policy "Users can update their keyword evidence cache"
  on public.keyword_intelligence_evidence_cache for update
  using (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces w
        where w.id = keyword_intelligence_evidence_cache.workspace_id
          and w.owner_id = auth.uid()
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces w
        where w.id = keyword_intelligence_evidence_cache.workspace_id
          and w.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete their keyword evidence cache" on public.keyword_intelligence_evidence_cache;
create policy "Users can delete their keyword evidence cache"
  on public.keyword_intelligence_evidence_cache for delete
  using (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1 from public.workspaces w
        where w.id = keyword_intelligence_evidence_cache.workspace_id
          and w.owner_id = auth.uid()
      )
    )
  );
