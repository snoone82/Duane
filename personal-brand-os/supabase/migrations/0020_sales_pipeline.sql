-- ============================================================================
-- Duane batch 8: Sales becomes operational (the main Sales area = live
-- execution; each client's Sales tab stays strategy).
--
-- Design: a prospect IS a client record with status 'prospect' — so
-- Won → Active Client is a status flip, and every meeting, note, action and
-- piece of history is already attached (Duane's "genuinely joined-up
-- system"). sales_opportunities hang off the client/prospect record and
-- carry the deal: value, probability, stage, owner, source, and a stage
-- history that seeds the opportunity timeline. Next actions live in the
-- existing actions table, linked by sales_opportunity_id, so sales work
-- shows up in the Actions backlog and Calendar like everything else.
-- ============================================================================

create table public.sales_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  title               text not null,            -- the service / offer being sold
  contact_name        text not null default '',
  estimated_value     numeric,
  value_type          text not null default 'monthly'
    check (value_type in ('monthly', 'project')),
  probability         integer not null default 50
    check (probability between 0 and 100),
  expected_close      date,
  owner_user_id       uuid references public.profiles(id) on delete set null,
  owner_name          text not null default '',
  source              text not null default '',
  notes               text not null default '',
  stage               text not null default 'prospect'
    check (stage in ('prospect', 'contacted', 'conversation', 'qualified', 'consultation', 'proposal', 'decision', 'won', 'lost')),
  -- [{stage, at}] appended on every stage change — the timeline's spine.
  stage_history       jsonb not null default '[]'::jsonb,
  closed_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index sales_opportunities_client_id_idx on public.sales_opportunities (client_id);
create index sales_opportunities_stage_idx on public.sales_opportunities (stage);
create trigger set_updated_at before update on public.sales_opportunities for each row execute function public.set_updated_at();

alter table public.sales_opportunities enable row level security;

-- Commercial pipeline = strategic access (admins + assigned members;
-- contractors and portal accounts never see it).
create policy sales_opportunities_all on public.sales_opportunities for all
  to authenticated
  using (public.has_strategic_access(client_id))
  with check (public.has_strategic_access(client_id));

-- Sales next-actions are ordinary Actions linked to their opportunity, so
-- they appear in the backlog, the calendar, and the client's Actions tab.
alter table public.actions
  add column sales_opportunity_id uuid references public.sales_opportunities(id) on delete set null;

create index actions_sales_opportunity_id_idx on public.actions (sales_opportunity_id);
