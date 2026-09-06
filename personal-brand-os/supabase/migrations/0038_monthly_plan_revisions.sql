-- Duane, after regenerating September three times: each import stacked
-- another 16 Master Content on the plan (and a deleted plan left its content
-- behind, unlinked — content_ideas.monthly_plan_id is `on delete set null`).
-- Imports are now scoped: replace the plan's own draft AI content, or add.
-- Once a plan is approved, a replace is no longer silent: the current plan
-- is snapshotted here as a numbered revision first, and the plan goes back
-- to review.

alter table public.monthly_plans
  add column revision integer not null default 1 check (revision >= 1);

comment on column public.monthly_plans.revision is
  'Bumped whenever an approved/active plan has its draft content replaced by a new import; the previous state is kept in monthly_plan_revisions.';

create table public.monthly_plan_revisions (
  id                 uuid primary key default gen_random_uuid(),
  monthly_plan_id    uuid not null references public.monthly_plans(id) on delete cascade,
  client_id          uuid not null references public.clients(id) on delete cascade,
  revision           integer not null check (revision >= 1),
  status_at_snapshot text not null,
  -- The full structured export (Client Snapshot, Master Content, Platform
  -- Outputs, Requirements) as it stood the moment it was superseded.
  snapshot           jsonb not null,
  note               text not null default '',
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (monthly_plan_id, revision)
);

create index monthly_plan_revisions_plan_idx on public.monthly_plan_revisions (monthly_plan_id);
create index monthly_plan_revisions_client_idx on public.monthly_plan_revisions (client_id);

alter table public.monthly_plan_revisions enable row level security;

create policy monthly_plan_revisions_all on public.monthly_plan_revisions for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));
