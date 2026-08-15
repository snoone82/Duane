-- ============================================================================
-- Brief §10 (Social Media Strategy), §12 (Sales Strategy), §22 (Client
-- Portal): the two remaining profile sections, plus the portal's data
-- foundations — a 'client' role, portal_user_id linkage, and read-only
-- portal policies scoped to exactly what §22 lists (never the internal
-- tables; meeting records surface only via a safe-column view).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- social_strategies — §10: one row per client per platform.
-- ----------------------------------------------------------------------------
create table public.social_strategies (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references public.clients(id) on delete cascade,
  platform             text not null,
  objective            text not null default '',
  audience             text not null default '',
  content_types        text not null default '',
  posting_frequency    text not null default '',
  growth_strategy      text not null default '',
  engagement_strategy  text not null default '',
  cta_strategy         text not null default '',
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (client_id, platform)
);

create index social_strategies_client_id_idx on public.social_strategies (client_id);
create trigger set_updated_at before update on public.social_strategies for each row execute function public.set_updated_at();

alter table public.social_strategies enable row level security;
create policy social_strategies_all on public.social_strategies for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));

-- ----------------------------------------------------------------------------
-- sales_strategy — §12: one row per client, same autosave pattern as
-- vision/positioning. Strategic access (contractors excluded) — this is
-- commercial strategy, squarely "internal picture".
-- ----------------------------------------------------------------------------
create table public.sales_strategy (
  client_id                uuid primary key references public.clients(id) on delete cascade,
  services_products        text not null default '',
  target_customers         text not null default '',
  ideal_clients            text not null default '',
  offers                   text not null default '',
  sales_messaging          text not null default '',
  lead_generation_approach text not null default '',
  calls_to_action          text not null default '',
  lead_magnets             text not null default '',
  enquiry_process          text not null default '',
  sales_conversations      text not null default '',
  referral_opportunities   text not null default '',
  updated_at               timestamptz not null default now()
);

create trigger set_updated_at before update on public.sales_strategy for each row execute function public.set_updated_at();

alter table public.sales_strategy enable row level security;
create policy sales_strategy_all on public.sales_strategy for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

-- Auto-create alongside vision/positioning for every new client…
create or replace function public.create_client_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_vision (client_id) values (new.id) on conflict do nothing;
  insert into public.positioning (client_id) values (new.id) on conflict do nothing;
  insert into public.sales_strategy (client_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- …and backfill for clients that already exist.
insert into public.sales_strategy (client_id)
select id from public.clients
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Portal linkage — §22/§23. A portal user is an auth user whose profile has
-- role 'client', linked from the client record they may see.
-- ----------------------------------------------------------------------------
alter table public.clients add column portal_user_id uuid references public.profiles(id) on delete set null;
create index clients_portal_user_id_idx on public.clients (portal_user_id);

comment on column public.clients.portal_user_id is 'The auth user (profiles.role = ''client'') who may view this client through the portal. One client account per client record.';

create or replace function public.is_portal_client_of(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients
    where id = target_client_id and portal_user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_portal_client_of(uuid) from public, anon;
grant execute on function public.is_portal_client_of(uuid) to authenticated;

-- Portal READ policies — additive (permissive) alongside the team policies,
-- select-only, and only on the §22 list: strategy (vision, positioning,
-- pillars, audiences, social strategy), priorities/actions, content
-- calendar (ideas), progress (milestones), metrics (snapshots + targets),
-- and their own client row. Deliberately NOT: consultations (view below),
-- scorecard, commercial tables, sales strategy, files (phase three), audit.
create policy clients_portal_select on public.clients for select
  to authenticated using (portal_user_id = (select auth.uid()));
create policy brand_vision_portal_select on public.brand_vision for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy positioning_portal_select on public.positioning for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy brand_pillars_portal_select on public.brand_pillars for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy audiences_portal_select on public.audiences for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy social_strategies_portal_select on public.social_strategies for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy actions_portal_select on public.actions for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy content_ideas_portal_select on public.content_ideas for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy milestones_portal_select on public.milestones for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy metric_snapshots_portal_select on public.metric_snapshots for select
  to authenticated using (public.is_portal_client_of(client_id));
create policy metric_targets_portal_select on public.metric_targets for select
  to authenticated using (public.is_portal_client_of(client_id));

-- Meeting summaries for the portal (§22 lists them) WITHOUT exposing the
-- candid internal fields (strategic_observations, challenges, commercial_
-- opportunities, client_updates stay internal). RLS is row-level only, so
-- column narrowing needs a view: SECURITY DEFINER semantics (the Postgres
-- default for views) + its own portal-ownership filter + security_barrier
-- so the planner can't leak rows past the filter.
create view public.portal_meeting_summaries
  with (security_barrier = true)
as
  select id, client_id, meeting_date, meeting_type, next_meeting_date, summary, wins
  from public.consultations
  where public.is_portal_client_of(client_id);

grant select on public.portal_meeting_summaries to authenticated;

-- A client-role user must never satisfy the team-side helpers even if a
-- client_assignments row is created for them by mistake.
create or replace function public.has_client_access(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.client_assignments ca
      join public.profiles p on p.id = ca.user_id
      where ca.client_id = target_client_id
        and ca.user_id = (select auth.uid())
        and p.role in ('member', 'contractor')
    );
$$;