-- ============================================================================
-- Duane batch 9: PBOS Sales and Client Sales become two different systems.
--
-- The crossover we had: one Sales area, doing two unrelated jobs. Aligned
-- Media selling PBOS, and a client selling their own services, were sharing
-- a table, a target and a dashboard. They are separated here.
--
--   PBOS Sales   = Duane growing PBOS as a business.
--                  pbos_leads -> pbos_opportunities -> (Won) -> clients +
--                  pbos_engagements. Never touches a client's own numbers.
--
--   Client Sales = a client using PBOS to hit THEIR commercial objectives.
--                  sales_strategy + commercial_outcomes/snapshots, already
--                  client-scoped, now with their own objective and target.
--
-- The load-bearing rule, applied throughout: a prospect is NOT a client.
-- A PBOS lead lives in pbos_leads and has no client record, no delivery
-- tabs, no portal, no place on the roster. Winning the deal is what creates
-- the client — with status 'onboarding', because a signed deal is the start
-- of onboarding, not the end of it.
--
-- The old sales_opportunities table hung opportunities off clients/id and so
-- forced every prospect to be faked as a client. It is dropped here (it was
-- empty on the live project; nothing to carry over) and replaced by the
-- lead-scoped tables below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_operator() — PBOS's own commercial data. Admins and members only:
-- contractors are delivery help and portal clients are customers; neither has
-- any business seeing what PBOS bills, wins or forecasts. Mirrors is_admin()
-- and is_team_member() in shape (SECURITY DEFINER, revoked from anon).
-- ----------------------------------------------------------------------------
create or replace function public.is_operator()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'member')
  );
$$;

revoke execute on function public.is_operator() from public, anon;
grant execute on function public.is_operator() to authenticated;

-- ----------------------------------------------------------------------------
-- pbos_tiers — the four ways to buy PBOS. A table, not a hard-coded list,
-- precisely because Duane wants the structure fixed and the pricing free to
-- change later: the default fees start null on purpose, and editing them
-- never touches the shape of anything downstream (an opportunity and an
-- engagement each store their own agreed figures, so re-pricing the tier
-- can't rewrite a deal already done).
-- ----------------------------------------------------------------------------
create table public.pbos_tiers (
  key                 text primary key
    check (key in ('self_serve', 'guided', 'managed', 'partner')),
  rank                smallint not null unique,
  name                text not null,
  promise             text not null default '',   -- the one-line pitch
  description         text not null default '',
  default_setup_fee   numeric,
  default_monthly_fee numeric,
  updated_at          timestamptz not null default now()
);

create trigger set_updated_at before update on public.pbos_tiers for each row execute function public.set_updated_at();

insert into public.pbos_tiers (key, rank, name, promise, description) values
  ('self_serve', 1, 'Self-Serve',
   'Here''s your PBOS. Run your brand through it.',
   'The client gets access to the system and runs it themselves.'),
  ('guided', 2, 'Guided',
   'We build the foundations with you and help you run it.',
   'Strategy and onboarding support plus ongoing guidance — the client still operates much of the system.'),
  ('managed', 3, 'Managed',
   'We operate the content machine for you.',
   'We manage the strategy, planning, content workflow and delivery through PBOS.'),
  ('partner', 4, 'Partner',
   'I work alongside you on the brand, business development and opportunities, while the team and PBOS handle execution.',
   'The highest-touch relationship, and commercially the most involved.');

alter table public.pbos_tiers enable row level security;

create policy pbos_tiers_select on public.pbos_tiers for select
  to authenticated using ((select public.is_operator()));
create policy pbos_tiers_update on public.pbos_tiers for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- pbos_leads — someone who might buy PBOS. Deliberately NOT a client: no
-- client_id, no vision/positioning/content, no portal login. converted_client_id
-- is the one-way door — it stays null until a deal is won.
-- ----------------------------------------------------------------------------
create table public.pbos_leads (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  company             text not null default '',
  job_title           text not null default '',
  email               text not null default '',
  phone               text not null default '',
  linkedin_url        text not null default '',
  website_url         text not null default '',
  source              text not null default '',
  -- Which tier we think they're for. An indication while qualifying; the
  -- opportunity carries the tier actually being sold.
  tier_interest       text references public.pbos_tiers(key) on delete set null,
  status              text not null default 'open'
    check (status in ('open', 'won', 'lost', 'dormant')),
  owner_user_id       uuid references public.profiles(id) on delete set null,
  owner_name          text not null default '',
  notes               text not null default '',
  converted_client_id uuid references public.clients(id) on delete set null,
  converted_at        timestamptz,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Won means converted, and converted means won. Nothing else can claim it.
  constraint pbos_leads_won_is_converted check (
    (status = 'won') = (converted_client_id is not null)
  )
);

create index pbos_leads_status_idx on public.pbos_leads (status);
create index pbos_leads_tier_interest_idx on public.pbos_leads (tier_interest);
create index pbos_leads_owner_user_id_idx on public.pbos_leads (owner_user_id);
create index pbos_leads_converted_client_id_idx on public.pbos_leads (converted_client_id);
create index pbos_leads_created_by_idx on public.pbos_leads (created_by);
create trigger set_updated_at before update on public.pbos_leads for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- pbos_opportunities — the deal itself: which tier, on what commercial terms.
-- Every money column is nullable so the structure ships before the pricing
-- does. expected_mrr is generated rather than typed, so the recurring number
-- on the dashboard can never drift from the fee and the extras it is made of.
-- ----------------------------------------------------------------------------
create table public.pbos_opportunities (
  id                   uuid primary key default gen_random_uuid(),
  lead_id              uuid not null references public.pbos_leads(id) on delete cascade,
  title                text not null,
  tier                 text not null references public.pbos_tiers(key),
  contact_name         text not null default '',

  -- Commercial terms
  setup_fee            numeric,                    -- one-off onboarding fee
  monthly_fee          numeric,                    -- the recurring tier fee
  extras               text not null default '',   -- what the optional extras are
  extras_monthly_value numeric,                    -- recurring value of those extras
  expected_mrr         numeric generated always as
    (coalesce(monthly_fee, 0) + coalesce(extras_monthly_value, 0)) stored,
  contract_start_date  date,
  contract_term_months integer check (contract_term_months is null or contract_term_months > 0),

  probability          integer not null default 50 check (probability between 0 and 100),
  expected_close       date,
  stage                text not null default 'lead'
    check (stage in ('lead', 'contacted', 'conversation', 'qualified', 'consultation', 'proposal', 'decision', 'won', 'lost')),
  -- [{stage, at}] appended on every stage change — the timeline's spine.
  stage_history        jsonb not null default '[]'::jsonb,
  closed_at            timestamptz,
  lost_reason          text not null default '',
  owner_user_id        uuid references public.profiles(id) on delete set null,
  owner_name           text not null default '',
  source               text not null default '',
  notes                text not null default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index pbos_opportunities_lead_id_idx on public.pbos_opportunities (lead_id);
create index pbos_opportunities_stage_idx on public.pbos_opportunities (stage);
create index pbos_opportunities_tier_idx on public.pbos_opportunities (tier);
create index pbos_opportunities_owner_user_id_idx on public.pbos_opportunities (owner_user_id);
create index pbos_opportunities_closed_at_idx on public.pbos_opportunities (closed_at);
create trigger set_updated_at before update on public.pbos_opportunities for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- pbos_engagements — what a won client is actually on: their tier, their
-- agreed terms, and the difference between what we expected to bill and what
-- we are billing. One row per client, created by the Won conversion; the
-- client's own delivery tables are untouched by any of it.
--
-- Terms are copied from the opportunity rather than referenced through it:
-- the deal is a record of what was agreed on the day, the engagement is what
-- is true now, and renegotiating one must not silently rewrite the other.
-- ----------------------------------------------------------------------------
create table public.pbos_engagements (
  client_id               uuid primary key references public.clients(id) on delete cascade,
  lead_id                 uuid references public.pbos_leads(id) on delete set null,
  opportunity_id          uuid references public.pbos_opportunities(id) on delete set null,
  tier                    text not null references public.pbos_tiers(key),

  setup_fee               numeric,
  setup_fee_invoiced_on   date,
  monthly_fee             numeric,
  extras                  text not null default '',
  extras_monthly_value    numeric,
  expected_mrr            numeric generated always as
    (coalesce(monthly_fee, 0) + coalesce(extras_monthly_value, 0)) stored,
  -- What is genuinely recurring today. Null until someone confirms it, so an
  -- unconfirmed engagement can never inflate the MRR figure by accident.
  actual_mrr              numeric,
  contract_start_date     date,
  contract_term_months    integer check (contract_term_months is null or contract_term_months > 0),

  status                  text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'paused', 'ended')),
  onboarding_started_at   timestamptz not null default now(),
  onboarding_completed_at timestamptz,
  ended_on                date,
  notes                   text not null default '',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index pbos_engagements_tier_idx on public.pbos_engagements (tier);
create index pbos_engagements_status_idx on public.pbos_engagements (status);
create index pbos_engagements_lead_id_idx on public.pbos_engagements (lead_id);
create index pbos_engagements_opportunity_id_idx on public.pbos_engagements (opportunity_id);
create trigger set_updated_at before update on public.pbos_engagements for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- pbos_lead_actions — the next step on a lead or a deal.
--
-- Deliberately not the client-scoped actions table: actions.client_id is NOT
-- NULL and every policy on it answers "which client is this?", which is
-- exactly the question a lead has no answer to. Chasing a proposal is Duane's
-- business development, not a client's delivery work, and it belongs on the
-- PBOS side of the wall.
-- ----------------------------------------------------------------------------
create table public.pbos_lead_actions (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.pbos_leads(id) on delete cascade,
  opportunity_id uuid references public.pbos_opportunities(id) on delete cascade,
  title          text not null,
  due_date       date,
  owner_user_id  uuid references public.profiles(id) on delete set null,
  owner_name     text not null default '',
  status         text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'waiting', 'completed')),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index pbos_lead_actions_lead_id_idx on public.pbos_lead_actions (lead_id);
create index pbos_lead_actions_opportunity_id_idx on public.pbos_lead_actions (opportunity_id);
create index pbos_lead_actions_owner_user_id_idx on public.pbos_lead_actions (owner_user_id);
create index pbos_lead_actions_due_date_idx on public.pbos_lead_actions (due_date) where status <> 'completed';
create trigger set_updated_at before update on public.pbos_lead_actions for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS. All four are business-level, not client-level: no has_client_access()
-- anywhere, because none of this belongs to a client.
-- ----------------------------------------------------------------------------
alter table public.pbos_leads enable row level security;
alter table public.pbos_opportunities enable row level security;
alter table public.pbos_engagements enable row level security;
alter table public.pbos_lead_actions enable row level security;

create policy pbos_leads_all on public.pbos_leads for all
  to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));
create policy pbos_opportunities_all on public.pbos_opportunities for all
  to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));
create policy pbos_engagements_all on public.pbos_engagements for all
  to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));
create policy pbos_lead_actions_all on public.pbos_lead_actions for all
  to authenticated using ((select public.is_operator())) with check ((select public.is_operator()));

-- ----------------------------------------------------------------------------
-- The old shared table goes. It modelled a prospect as a client, which is the
-- exact thing being unpicked. Empty on the live project, so nothing is lost.
-- ----------------------------------------------------------------------------
-- Column first: its FK is what would otherwise block the drop.
alter table public.actions drop column sales_opportunity_id;
drop table public.sales_opportunities;

-- ----------------------------------------------------------------------------
-- Client Sales gets the one thing it was missing: the client's OWN commercial
-- objective and their own monthly revenue target, so "progress against target"
-- on their Sales tab means their target and not PBOS's £20k.
-- ----------------------------------------------------------------------------
alter table public.sales_strategy
  add column sales_objective       text not null default '',
  add column monthly_revenue_target numeric;

comment on column public.sales_strategy.sales_objective is
  'The client''s own commercial objective — what the brand is meant to earn them. Nothing to do with PBOS revenue.';
comment on column public.sales_strategy.monthly_revenue_target is
  'The client''s own monthly revenue target, measured against commercial_outcomes on their Sales tab.';

comment on column public.workspace_settings.monthly_sales_target is
  'PBOS''s own monthly sales target (Duane''s £20k) — revenue PBOS generates, never revenue a client generates.';

comment on table public.pbos_leads is 'PBOS''s own prospects. A lead is not a client: winning the deal is what creates the client record.';
comment on table public.pbos_opportunities is 'A PBOS deal against a lead — which tier, on what terms.';
comment on table public.pbos_engagements is 'What a won client is actually on: tier, agreed terms, expected vs actual MRR.';
