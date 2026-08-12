-- ============================================================================
-- Aligned — Phase One schema
-- Tables: life_areas, audits, audit_responses, profiles
-- Run this in the Supabase SQL Editor on a fresh project (or via
-- `supabase db push` / apply_migration once MCP access to the project exists).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- life_areas
-- The ten (or however many) areas of the audit. Content-managed by Duane —
-- never hardcoded in the app.
-- ----------------------------------------------------------------------------
create table public.life_areas (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null,
  sort_order   integer not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (sort_order)
);

comment on table public.life_areas is 'The areas of the life audit. Content-managed; never hardcode in the app.';

-- ----------------------------------------------------------------------------
-- audits
-- One row per completed-or-in-progress audit. Never overwritten once
-- completed — see the immutability trigger below.
-- ----------------------------------------------------------------------------
create type public.audit_status as enum ('in_progress', 'completed');

create table public.audits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           public.audit_status not null default 'in_progress',
  sequence_number  integer not null,
  leverage_area_id uuid references public.life_areas(id),
  total_score      integer,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, sequence_number)
);

comment on table public.audits is 'One permanent snapshot per audit. Completed audits are immutable — enforced by trigger.';

create index audits_user_id_idx on public.audits (user_id);

-- ----------------------------------------------------------------------------
-- audit_responses
-- One row per (audit, life_area). Satisfaction 1-10, importance 1-5,
-- priority_score is derived (importance-weighted gap) and generated in-db.
-- ----------------------------------------------------------------------------
create table public.audit_responses (
  id                 uuid primary key default gen_random_uuid(),
  audit_id           uuid not null references public.audits(id) on delete cascade,
  life_area_id       uuid not null references public.life_areas(id),
  satisfaction_score smallint not null check (satisfaction_score between 1 and 10),
  importance_score   smallint not null check (importance_score between 1 and 5),
  -- Weighted priority for the coach: higher importance + lower satisfaction = higher priority.
  -- Range: importance(1-5) * (10 - satisfaction(1-10)) => 0 to 45.
  priority_score     smallint generated always as
                        (importance_score * (10 - satisfaction_score)) stored,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (audit_id, life_area_id)
);

comment on table public.audit_responses is 'Per-area ratings for one audit. priority_score is derived, for the coach only — never shown to the user.';

create index audit_responses_audit_id_idx on public.audit_responses (audit_id);

-- ----------------------------------------------------------------------------
-- profiles
-- Mirrors auth.users. Created automatically on user creation (including
-- anonymous sign-in), kept in sync on update.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  is_anonymous boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Mirror of auth.users, one row per user, kept in sync by trigger.';

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at maintenance -------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger life_areas_set_updated_at
  before update on public.life_areas
  for each row execute function public.set_updated_at();

create trigger audit_responses_set_updated_at
  before update on public.audit_responses
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- audits.sequence_number: auto-assigned per user, never set by the client --
create function public.set_audit_sequence_number()
returns trigger
language plpgsql
as $$
begin
  if new.sequence_number is not null then
    raise exception 'sequence_number is assigned automatically and must not be set by the client';
  end if;

  select coalesce(max(sequence_number), 0) + 1
    into new.sequence_number
    from public.audits
    where user_id = new.user_id;

  return new;
end;
$$;

create trigger audits_set_sequence_number
  before insert on public.audits
  for each row execute function public.set_audit_sequence_number();

-- audits immutability: once completed, no further edits ------------------
-- Allows the in_progress -> completed transition (setting status,
-- total_score, completed_at, leverage_area_id) but blocks any change to a
-- row that is already completed. This is intentional product behaviour —
-- do not "fix" this trigger when it throws.
create function public.enforce_audit_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' then
    raise exception 'audit % is completed and cannot be modified — history is never overwritten', old.id
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

create trigger audits_enforce_immutability
  before update on public.audits
  for each row execute function public.enforce_audit_immutability();

-- audit_responses immutability: blocked once the parent audit is completed
create function public.enforce_audit_response_immutability()
returns trigger
language plpgsql
as $$
declare
  parent_status public.audit_status;
begin
  select status into parent_status from public.audits where id = coalesce(new.audit_id, old.audit_id);

  if parent_status = 'completed' then
    raise exception 'audit % is completed — responses cannot be added or changed', coalesce(new.audit_id, old.audit_id)
      using errcode = 'raise_exception';
  end if;

  return new;
end;
$$;

create trigger audit_responses_enforce_immutability
  before insert or update on public.audit_responses
  for each row execute function public.enforce_audit_response_immutability();

-- profiles: auto-create on new auth.users row, keep in sync on update ----
create function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_anonymous)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do update
    set email        = excluded.email,
        full_name    = coalesce(excluded.full_name, public.profiles.full_name),
        is_anonymous = excluded.is_anonymous,
        updated_at   = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_change();

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.life_areas enable row level security;
alter table public.audits enable row level security;
alter table public.audit_responses enable row level security;
alter table public.profiles enable row level security;

-- life_areas: readable by any signed-in user (including anonymous sessions,
-- which are `authenticated` with is_anonymous = true). No write access from
-- the client at all — content is managed from the Supabase dashboard.
create policy "life_areas readable by authenticated"
  on public.life_areas for select
  to authenticated
  using (true);

-- audits: a user may only see/insert/update their own rows. The immutability
-- trigger above is what actually stops edits to completed audits — this
-- policy just scopes everything to auth.uid().
create policy "audits select own"
  on public.audits for select
  to authenticated
  using (user_id = auth.uid());

create policy "audits insert own"
  on public.audits for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "audits update own"
  on public.audits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_responses: scoped via the parent audit's ownership.
create policy "audit_responses select own"
  on public.audit_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.audits
      where audits.id = audit_responses.audit_id
        and audits.user_id = auth.uid()
    )
  );

create policy "audit_responses insert own"
  on public.audit_responses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.audits
      where audits.id = audit_responses.audit_id
        and audits.user_id = auth.uid()
    )
  );

create policy "audit_responses update own"
  on public.audit_responses for update
  to authenticated
  using (
    exists (
      select 1 from public.audits
      where audits.id = audit_responses.audit_id
        and audits.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.audits
      where audits.id = audit_responses.audit_id
        and audits.user_id = auth.uid()
    )
  );

-- profiles: read own row only. Writes happen only via the security-definer
-- trigger above, never directly from the client.
create policy "profiles select own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- ============================================================================
-- Seed data: the ten life areas
-- Wording is a starting point — content-managed by Duane from here on.
-- ============================================================================

insert into public.life_areas (name, description, sort_order) values
  ('Career & Purpose', 'The work you do, and how much it feels like it matters.', 1),
  ('Money & Finances', 'Income, savings, debt, and how in-control you feel financially.', 2),
  ('Health & Fitness', 'Physical health, energy levels, sleep, and how your body feels day to day.', 3),
  ('Emotional Wellbeing', 'Your mental and emotional state — stress, mood, resilience.', 4),
  ('Relationships', 'Partner, family, friendships — the closeness and quality of your connections.', 5),
  ('Personal Growth', 'Learning, developing, and becoming who you want to be.', 6),
  ('Fun & Recreation', 'Play, hobbies, and time spent doing things purely because you enjoy them.', 7),
  ('Physical Environment', 'Your home, workspace, and the physical spaces you live in day to day.', 8),
  ('Contribution & Community', 'Your sense of belonging, and what you give back to others.', 9),
  ('Spirituality & Meaning', 'Whatever gives your life a sense of meaning beyond the day to day.', 10)
on conflict (sort_order) do nothing;
