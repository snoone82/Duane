-- Monthly Plan — the structured planning layer underneath the client PDF
-- (Duane, 5 Sep 2026), built from a real populated example (Daniel Andrews /
-- CEG, October 2026) rather than guessed. Four areas:
--
--   Client Snapshot   — this migration + a snapshot taken at creation time
--   Master Content    — content_ideas, scoped to a plan
--   Platform Outputs  — content_outputs, unchanged (already hangs off ideas)
--   Requirements      — its own table; the real shape doesn't fit `actions`
--
-- Nothing here wires up AI. This is deliberately just the data a person (or
-- later, Claude) can be asked to fill in — see lib/actions/monthly-plans.ts
-- for the export/import round trip.

-- ============================================================================
-- 1. monthly_plans — one per client per month.
-- ============================================================================
create table public.monthly_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  -- Always the first of the month — "October 2026" as a real date, not a
  -- string, so ordering and "current month" queries are just date math.
  period_month date not null,
  status      text not null default 'planning'
    check (status in ('planning', 'in_review', 'approved', 'active', 'closed')),

  -- The Client Snapshot's synthesis half: not a clean pull from anywhere on
  -- the client record, closer to what a strategist writes fresh each month
  -- looking at the underlying strategy. Defaults are best-effort suggestions
  -- from the profile at creation time (see createMonthlyPlan) — editable
  -- from there, never re-pulled automatically afterwards.
  primary_objective        text not null default '',
  secondary_objectives     text not null default '',
  global_tone_notes        text not null default '',
  preferred_language       text not null default '',
  avoid_language           text not null default '',
  cta_priorities           text not null default '',
  primary_cta_destination  text not null default '',
  scope_status             text not null default '',

  -- The Client Snapshot's auto-pulled half: audiences, pillars, and
  -- per-platform cadence/tone/CTA rules already live as real rows on
  -- audiences / brand_pillars / social_strategies — frozen here as JSON at
  -- creation time so the plan reads the same in a year even after the
  -- client's live profile has moved on. Never re-derived from the jsonb;
  -- always read from the real tables when the live picture is wanted.
  snapshot    jsonb not null default '{}'::jsonb,

  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (client_id, period_month)
);

create index monthly_plans_client_id_idx on public.monthly_plans (client_id);
create index monthly_plans_created_by_idx on public.monthly_plans (created_by);

create trigger set_updated_at before update on public.monthly_plans
  for each row execute function public.set_updated_at();

alter table public.monthly_plans enable row level security;

create policy monthly_plans_all on public.monthly_plans for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create trigger audit_monthly_plans after insert or update or delete on public.monthly_plans
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 2. Master Content — content_ideas scoped to a plan, plus the fields the
-- real spreadsheet has that a plain content idea doesn't: a distinct core
-- message vs. hook vs. purpose, a plan-level CTA and destination a platform
-- version can inherit, a lead platform, and a fuller first-draft copy.
-- ============================================================================
alter table public.content_ideas
  add column monthly_plan_id uuid references public.monthly_plans(id) on delete set null,
  -- Stable "MC-01" style numbering within one plan, assigned at insert —
  -- see assignPlanSequence(). Null for every idea outside a plan (the
  -- overwhelming majority of existing rows) and for a plan's own rows,
  -- gives the AI import a stable id to reference before any of them exist
  -- as real UUIDs yet.
  add column plan_sequence integer,
  add column core_message text not null default '',
  add column purpose text not null default '',
  add column cta text not null default '',
  add column cta_destination text not null default '',
  add column lead_platform text not null default '',
  add column lead_draft_copy text not null default '',
  -- Who actually proposed this: a person typing it in, a portal client's
  -- own submission (content_ideas already has that path), or an AI import.
  -- Never a status — 'idea' already means "not reviewed yet" for every
  -- origin; this only decides whether the UI badges it as AI-proposed.
  add column origin text not null default 'manual'
    check (origin in ('manual', 'client', 'ai_import'));

create index content_ideas_monthly_plan_id_idx on public.content_ideas (monthly_plan_id);

comment on column public.content_ideas.plan_sequence is
  'Per-plan display number ("MC-01"). Null outside a Monthly Plan. Assigned once at creation, in the order ideas are added to the plan.';
comment on column public.content_ideas.core_message is
  'The single-sentence takeaway — distinct from the hook (the opening line) and the brief in body.';
comment on column public.content_ideas.lead_draft_copy is
  'A fuller first draft of publish-ready copy for the lead platform — richer than the working brief in body, and what an AI import or a strategist starts from.';

-- ============================================================================
-- 3. Platform Outputs — content_outputs unchanged, plus a media *brief*: a
-- description of what's needed before a real asset exists (Duane's "Media
-- reference" column), separate from media_path/media_url which are for the
-- real uploaded file once someone sources it. "Media state" itself
-- (concept vs. sourced vs. final) is derived in the UI from whether those
-- are populated, not stored — one fewer thing that can drift out of sync.
-- ============================================================================
alter table public.content_outputs
  add column media_brief text not null default '',
  add column origin text not null default 'manual'
    check (origin in ('manual', 'client', 'ai_import'));

comment on column public.content_outputs.media_brief is
  'What media this version needs, described in words, before a real asset is sourced or uploaded — e.g. "Use Daniel/CEG owned image or approved concept frame."';

-- ============================================================================
-- 4. Requirements — its own table. The real shape (an owner that's often
-- two people at once, a due date, a simple open/confirmed/done state, and a
-- "depends on" note that's sometimes a real list of Master Content items
-- and sometimes "All Instagram outputs") doesn't fit actions' single-owner,
-- checklist-driven model without forcing it.
-- ============================================================================
create table public.monthly_plan_requirements (
  id               uuid primary key default gen_random_uuid(),
  monthly_plan_id  uuid not null references public.monthly_plans(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  type             text not null default 'other'
    check (type in ('filming', 'asset_upload', 'information', 'decision_approval', 'access', 'other')),
  description      text not null default '',
  -- Free text, deliberately: real requirements name more than one person
  -- ("Daniel / Charlie", "Daniel / Duane") more often than they name one.
  owner_note       text not null default '',
  due_date         date,
  state            text not null default 'open'
    check (state in ('open', 'needs_confirmation', 'received', 'done')),
  -- Free text, not a resolved list: sometimes real Master Content ids
  -- ("MC-02, MC-08"), sometimes not ("All Instagram outputs") — forcing
  -- every value through a foreign key would lose the ones that don't
  -- resolve to specific items.
  related_content_note text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index monthly_plan_requirements_plan_id_idx on public.monthly_plan_requirements (monthly_plan_id);
create index monthly_plan_requirements_client_id_idx on public.monthly_plan_requirements (client_id);

create trigger set_updated_at before update on public.monthly_plan_requirements
  for each row execute function public.set_updated_at();

alter table public.monthly_plan_requirements enable row level security;

create policy monthly_plan_requirements_all on public.monthly_plan_requirements for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create trigger audit_monthly_plan_requirements after insert or update or delete on public.monthly_plan_requirements
  for each row execute function public.log_audit_event();

-- Deliberately no portal policy on either new table yet. The client-facing
-- surface for a Monthly Plan is the PDF Duane wants built last, over the
-- top of this once the data and the AI round trip both work — not a raw
-- view onto these rows.
