-- ============================================================================
-- Aligned Media — Personal Brand OS — Phase One schema
--
-- Separate Supabase project from "Aligned" (the coaching product) by design
-- — see build brief §1. Run this in this project's SQL Editor on a fresh
-- Supabase project, then regenerate lib/database.types.ts:
--
--   npx supabase gen types typescript --project-id <id> > lib/database.types.ts
--
-- No service-role key is ever used by the app — every table below has RLS
-- enabled and every access path goes through it as the signed-in user.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.profile_role as enum ('admin', 'member');
create type public.client_status as enum ('prospect', 'active', 'paused', 'offboarded');
create type public.content_status as enum
  ('idea', 'approved', 'drafted', 'created', 'edited', 'scheduled', 'published', 'measured');
create type public.authority_status as enum
  ('identified', 'pitched', 'in_conversation', 'booked', 'completed', 'published', 'declined');
create type public.action_status as enum ('open', 'in_progress', 'done');
create type public.file_category as enum
  ('headshot', 'one_pager', 'content_asset', 'contract', 'brand_guide', 'other');

-- ----------------------------------------------------------------------------
-- profiles
-- One row per team member (Duane + staff). Created automatically when Duane
-- adds someone in Authentication → Users — there is no public signup, so this
-- is the only way a profiles row comes into existence. Someone who signs in
-- without a profile row sees a "no access" screen rather than an empty
-- dashboard (see app/(auth)/no-access).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        public.profile_role not null default 'member',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Internal team members only. No client ever gets a row here — that is what portal_user_id (phase two, not built) is for.';

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  company       text,
  job_title     text,
  industry      text,
  status        public.client_status not null default 'prospect',
  package       text,
  email         text,
  phone         text,
  photo_url     text,
  linkedin_url  text,
  website_url   text,
  twitter_url   text,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.clients is 'The roster. Everything else in the schema hangs off client_id.';

-- ----------------------------------------------------------------------------
-- client_assignments
-- Which team members can see which clients. Admins (role = 'admin') see
-- every client regardless of this table — see has_client_access() below.
-- ----------------------------------------------------------------------------
create table public.client_assignments (
  client_id   uuid not null references public.clients(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- ----------------------------------------------------------------------------
-- brand_vision — one row per client, six long-form fields (autosaved).
-- "What are we trying to achieve?"
-- ----------------------------------------------------------------------------
create table public.brand_vision (
  client_id           uuid primary key references public.clients(id) on delete cascade,
  vision_statement     text not null default '',
  mission_statement     text not null default '',
  audience_goals       text not null default '',
  authority_goals       text not null default '',
  commercial_goals     text not null default '',
  success_definition   text not null default '',
  updated_at           timestamptz not null default now()
);

comment on column public.brand_vision.vision_statement is 'Where this brand is headed over the next 3-5 years.';
comment on column public.brand_vision.mission_statement is 'Why this work matters to them, personally.';
comment on column public.brand_vision.audience_goals is 'Who they ultimately want to reach and serve.';
comment on column public.brand_vision.authority_goals is 'The recognition/credibility they want to be known for.';
comment on column public.brand_vision.commercial_goals is 'The business outcomes the brand is meant to drive.';
comment on column public.brand_vision.success_definition is 'What "working" looks like to them, in their own words.';

-- ----------------------------------------------------------------------------
-- positioning — one row per client, eight long-form fields (autosaved).
-- "Who is this person?"
-- ----------------------------------------------------------------------------
create table public.positioning (
  client_id                 uuid primary key references public.clients(id) on delete cascade,
  positioning_statement     text not null default '',
  category                  text not null default '',
  target_audience           text not null default '',
  unique_value_proposition  text not null default '',
  key_differentiators       text not null default '',
  origin_story              text not null default '',
  core_expertise            text not null default '',
  tone_and_voice            text not null default '',
  updated_at                timestamptz not null default now()
);

comment on column public.positioning.positioning_statement is 'One sentence: known for X, helps Y achieve Z.';
comment on column public.positioning.category is 'The space/category this person owns.';
comment on column public.positioning.origin_story is 'The background that underpins their credibility.';

-- ----------------------------------------------------------------------------
-- audiences — many per client, expandable/editable records.
-- ----------------------------------------------------------------------------
create table public.audiences (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  demographics    text not null default '',
  pain_points     text not null default '',
  goals           text not null default '',
  where_they_are  text not null default '',
  notes           text not null default '',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- brand_pillars
-- ----------------------------------------------------------------------------
create table public.brand_pillars (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- content_ideas — the idea pipeline.
-- idea → approved → drafted → created → edited → scheduled → published → measured
-- ----------------------------------------------------------------------------
create table public.content_ideas (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  pillar_id      uuid references public.brand_pillars(id) on delete set null,
  title          text not null,
  body           text not null default '',
  platform       text,
  status         public.content_status not null default 'idea',
  due_date       date,
  published_url  text,
  notes          text not null default '',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index content_ideas_client_status_idx on public.content_ideas (client_id, status);

-- ----------------------------------------------------------------------------
-- authority_opportunities — the authority pipeline.
-- identified → pitched → in_conversation → booked → completed → published
-- (or declined, at any point)
-- ----------------------------------------------------------------------------
create table public.authority_opportunities (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  type              text not null,
  host              text,
  contact_name      text,
  contact_email     text,
  opportunity_date  date,
  status            public.authority_status not null default 'identified',
  published_url     text,
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index authority_opportunities_client_status_idx on public.authority_opportunities (client_id, status);

-- ----------------------------------------------------------------------------
-- consultations — internal only, by policy. Never exposed to a client, now
-- or in phase two's portal.
-- ----------------------------------------------------------------------------
create table public.consultations (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  meeting_date       date not null default current_date,
  next_meeting_date  date,
  summary            text not null default '',
  attendees          text not null default '',
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.consultations is 'Internal-only. These are the notes — there is deliberately no separate "notes" feature.';

-- ----------------------------------------------------------------------------
-- actions — can be owned by a team member (owner_user_id) or by someone with
-- no login, e.g. the client themself or an external editor (owner_name).
-- ----------------------------------------------------------------------------
create table public.actions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  title            text not null,
  description      text not null default '',
  owner_user_id    uuid references public.profiles(id) on delete set null,
  owner_name       text,
  status           public.action_status not null default 'open',
  due_date         date,
  consultation_id  uuid references public.consultations(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz,
  constraint actions_owner_present check (owner_user_id is not null or owner_name is not null)
);

create index actions_client_status_idx on public.actions (client_id, status);
create index actions_due_date_idx on public.actions (due_date);

-- ----------------------------------------------------------------------------
-- metric_snapshots — hand-entered, always. No "connect LinkedIn" button, ever
-- — LinkedIn does not expose personal-profile analytics to third parties.
-- ----------------------------------------------------------------------------
create table public.metric_snapshots (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  platform         text not null,
  snapshot_date    date not null,
  value            numeric not null,
  engagement_rate  numeric,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  unique (client_id, platform, snapshot_date)
);

comment on table public.metric_snapshots is 'The unique constraint means a second snapshot for the same client/platform/day upserts rather than erroring — see lib/actions/metrics.ts.';

-- ----------------------------------------------------------------------------
-- metric_targets — one per client/platform. baseline → current → target is
-- the primary display; "current" is always the latest metric_snapshots row.
-- ----------------------------------------------------------------------------
create table public.metric_targets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  platform        text not null,
  baseline_value  numeric,
  target_value    numeric,
  target_date     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, platform)
);

-- ----------------------------------------------------------------------------
-- scorecard_entries — internal only. Ten fixed categories, 1-10 scale.
-- ----------------------------------------------------------------------------
create table public.scorecard_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  category    text not null,
  score       numeric(4, 1) not null,
  scored_at   date not null default current_date,
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  constraint scorecard_entries_category_check check (category in (
    'Positioning Clarity', 'Content Consistency', 'Content Quality', 'Audience Growth',
    'Engagement Quality', 'Authority & Visibility', 'Network & Relationships',
    'Visual Brand', 'Commercial Conversion', 'Operational Discipline'
  )),
  constraint scorecard_entries_score_range check (score >= 0 and score <= 10)
);

comment on table public.scorecard_entries is 'Internal only. The ten category names are also fixed in lib/scorecard.ts — keep both in sync if this list ever changes.';

create index scorecard_entries_client_category_idx on public.scorecard_entries (client_id, category, scored_at desc);

-- ----------------------------------------------------------------------------
-- commercial_outcomes — internal only. A log of results attributed to the
-- brand work (a deal closed, a speaking fee, an inbound lead converted).
-- ----------------------------------------------------------------------------
create table public.commercial_outcomes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  description   text not null,
  value         numeric,
  outcome_date  date not null default current_date,
  source        text,
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

comment on table public.commercial_outcomes is 'Internal only, per the brief''s data notes. Shown in the Metrics tab as a plain log, not a chart — see §"What good looks like" re: no vanity totals.';

-- ----------------------------------------------------------------------------
-- milestones — the timeline. Highlighted ones are shown to the client at
-- renewal.
-- ----------------------------------------------------------------------------
create table public.milestones (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  title           text not null,
  description     text not null default '',
  milestone_date  date not null,
  is_highlighted  boolean not null default false,
  created_at      timestamptz not null default now()
);

create index milestones_client_date_idx on public.milestones (client_id, milestone_date);

-- ----------------------------------------------------------------------------
-- client_files — metadata only; the bytes live in Supabase Storage under
-- clients/{client_id}/ in the private "client-files" bucket (policies below).
-- ----------------------------------------------------------------------------
create table public.client_files (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  file_name      text not null,
  storage_path   text not null,
  category       public.file_category not null default 'other',
  size_bytes     bigint,
  uploaded_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ============================================================================
-- Helper functions for RLS
--
-- SECURITY DEFINER + a pinned search_path so these can be called from
-- policies on profiles/client_assignments themselves without the classic
-- "RLS policy on a table queries the same table" infinite-recursion problem
-- (they execute with the function owner's privileges, which is how Supabase's
-- own docs recommend breaking that cycle).
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

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
      select 1 from public.client_assignments
      where client_id = target_client_id and user_id = auth.uid()
    );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at housekeeping, applied per-table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_vision for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.positioning for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.audiences for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brand_pillars for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.content_ideas for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.authority_opportunities for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.consultations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.actions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.metric_targets for each row execute function public.set_updated_at();

-- Duane adds people via Authentication → Users; this is what turns that into
-- a usable app account. Default role is 'member' — promote to 'admin' via
-- the SQL editor (`update public.profiles set role = 'admin' where email = ...`).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A non-admin can't grant themself the admin role by editing their own
-- profile row through the app.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role = old.role;
  end if;
  return new;
end;
$$;

create trigger prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- A team member who adds a client can immediately see the client they just
-- created, without waiting on an admin to assign it. Admins already see
-- every client, so this is a harmless no-op for them.
create or replace function public.assign_creator_to_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.client_assignments (client_id, user_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger assign_creator_to_client
  after insert on public.clients
  for each row execute function public.assign_creator_to_client();

-- Vision and Positioning are always-one-row-per-client, autosaving forms —
-- creating both rows the moment a client exists means the app only ever
-- needs UPDATE, never an upsert-or-insert branch in the tab code.
create or replace function public.create_client_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_vision (client_id) values (new.id) on conflict do nothing;
  insert into public.positioning (client_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger create_client_defaults
  after insert on public.clients
  for each row execute function public.create_client_defaults();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_assignments enable row level security;
alter table public.brand_vision enable row level security;
alter table public.positioning enable row level security;
alter table public.audiences enable row level security;
alter table public.brand_pillars enable row level security;
alter table public.content_ideas enable row level security;
alter table public.authority_opportunities enable row level security;
alter table public.consultations enable row level security;
alter table public.actions enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.metric_targets enable row level security;
alter table public.scorecard_entries enable row level security;
alter table public.commercial_outcomes enable row level security;
alter table public.milestones enable row level security;
alter table public.client_files enable row level security;

-- profiles: everyone with a profile can read every profile (needed for
-- "owner" pickers/labels across the app); only self or an admin can update,
-- and the trigger above blocks a role change unless the actor is an admin.
create policy profiles_select_all on public.profiles for select
  to authenticated using (true);
create policy profiles_update_self_or_admin on public.profiles for update
  to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- client_assignments: a member sees their own assignment rows (so the app
-- can show them their client list); only admins manage assignments.
create policy client_assignments_select on public.client_assignments for select
  to authenticated using (user_id = auth.uid() or public.is_admin());
create policy client_assignments_admin_write on public.client_assignments for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- clients: visible/editable only to admins and assigned team members.
-- Any signed-in team member can create a client (fast-entry requirement in
-- the brief); the assign_creator_to_client trigger gives them access to it.
create policy clients_select on public.clients for select
  to authenticated using (public.has_client_access(id));
create policy clients_insert on public.clients for insert
  to authenticated with check (exists (select 1 from public.profiles where id = auth.uid()));
create policy clients_update on public.clients for update
  to authenticated using (public.has_client_access(id)) with check (public.has_client_access(id));
create policy clients_delete on public.clients for delete
  to authenticated using (public.is_admin());

-- Every remaining client-scoped table follows the same shape: visible and
-- editable exactly to whoever has_client_access() on its client_id. This is
-- also what makes consultations/commercial_outcomes/scorecard_entries
-- "internal only" true today — there is no client-facing role yet at all.
create policy brand_vision_all on public.brand_vision for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy positioning_all on public.positioning for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy audiences_all on public.audiences for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy brand_pillars_all on public.brand_pillars for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy content_ideas_all on public.content_ideas for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy authority_opportunities_all on public.authority_opportunities for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy consultations_all on public.consultations for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy actions_all on public.actions for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy metric_snapshots_all on public.metric_snapshots for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy metric_targets_all on public.metric_targets for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy scorecard_entries_all on public.scorecard_entries for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy commercial_outcomes_all on public.commercial_outcomes for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy milestones_all on public.milestones for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));
create policy client_files_all on public.client_files for all
  to authenticated using (public.has_client_access(client_id)) with check (public.has_client_access(client_id));

-- ============================================================================
-- global_search view
--
-- `security_invoker = true` is what makes this respect RLS per the querying
-- user rather than the view owner (Postgres 15+; Supabase runs 15+) — without
-- it every signed-in user would see every client's data through search
-- regardless of client_assignments, which would silently break acceptance
-- test 9. Query it exactly as the brief specifies:
--   select * from global_search where title ilike '%term%' or body ilike '%term%' order by updated_at desc
-- ============================================================================
create view public.global_search
  with (security_invoker = true)
as
  select 'client'::text as kind, id, id as client_id, name as title,
    trim(concat_ws(' ', company, job_title, industry)) as body, updated_at
  from public.clients
  union all
  select 'content_idea', id, client_id, title, trim(concat_ws(' ', body, notes)), updated_at
  from public.content_ideas
  union all
  select 'authority', id, client_id, coalesce(nullif(host, ''), type), trim(concat_ws(' ', notes, contact_name)), updated_at
  from public.authority_opportunities
  union all
  select 'consultation', id, client_id, 'Consultation — ' || to_char(meeting_date, 'YYYY-MM-DD'), summary, updated_at
  from public.consultations
  union all
  select 'action', id, client_id, title, description, updated_at
  from public.actions
  union all
  select 'pillar', id, client_id, name, description, updated_at
  from public.brand_pillars;

grant select on public.global_search to authenticated;

-- ============================================================================
-- Storage — private client file library
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('client-files', 'client-files', false)
on conflict (id) do nothing;

-- Objects are stored as clients/{client_id}/{filename}; the second path
-- segment is the client_id, checked against the same has_client_access() as
-- the client_files metadata table so the two can never drift apart.
create policy client_files_storage_select on storage.objects for select
  to authenticated using (
    bucket_id = 'client-files'
    and public.has_client_access(((storage.foldername(name))[2])::uuid)
  );
create policy client_files_storage_insert on storage.objects for insert
  to authenticated with check (
    bucket_id = 'client-files'
    and public.has_client_access(((storage.foldername(name))[2])::uuid)
  );
create policy client_files_storage_delete on storage.objects for delete
  to authenticated using (
    bucket_id = 'client-files'
    and public.has_client_access(((storage.foldername(name))[2])::uuid)
  );
