-- ============================================================================
-- Aligned — Phase Two schema (draft, NOT YET APPLIED)
-- Tables: clear_plans, goals, checkins
--
-- Combines the current Phase One Audit (unchanged) with the structure from
-- Duane's the-aligned.com build: Results/Priority Focus already exist as the
-- leverage question; this adds what comes after it — CLEAR, Goals, the
-- 30-Day Tracker.
--
-- Deliberately NOT included: session_notes, audit_reviews. Both are
-- coach-facing (Duane reviewing a client) — still out of scope per the
-- original brief, unchanged by this phase. Reserved names, not built.
--
-- Deliberately renamed from the brief's original placeholders:
-- - `checkins` kept as originally named.
-- - `goal_actions` is not a separate table — the-aligned.com's goal fields
--   (type, action, frequency, success criteria, what to track, why) all
--   live directly on one `goals` row per goal, not a separate join table.
--   Simpler, and matches how audit_responses already stores its fields
--   directly rather than through a side table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- clear_plans
-- One row per CLEAR cycle (Current Reality / Life Vision / Emotional Blocks /
-- Aligned Goal / Roadmap & Review) for one focus area. Started from a
-- completed audit's leverage question answer — the-aligned.com's "Priority
-- Focus" screen is exactly that leverage-question answer, so there's no
-- separate "choose your focus" step here.
--
-- Step 4 (Aligned Goal) doesn't store its own fields here — completing it
-- creates the primary `goals` row, referenced back via goal_id.
--
-- Reuses `audit_status` (in_progress/completed) rather than inventing a new
-- near-identical enum.
-- ----------------------------------------------------------------------------
create table public.clear_plans (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  audit_id                 uuid not null references public.audits(id),
  life_area_id             uuid not null references public.life_areas(id),
  status                   public.audit_status not null default 'in_progress',
  current_step             smallint not null default 1 check (current_step between 1 and 5),

  -- Step 1 — C: Current Reality
  current_reality_look_like text,
  current_reality_pressure  text,
  current_reality_pattern   text,

  -- Step 2 — L: Life Vision
  life_vision_thriving      text,
  life_vision_feel          text,
  life_vision_becoming      text,

  -- Step 3 — E: Emotional Blocks
  emotional_block_belief    text,
  emotional_block_emotion   text,
  emotional_block_response  text,

  -- Step 4 — A: Aligned Goal (the goal itself lives in `goals`, defined
  -- further down — the FK is added via ALTER TABLE once that table exists).
  goal_id                  uuid,

  -- Step 5 — R: Roadmap & Review
  roadmap_weekly_action     text,
  roadmap_obstacles         text,
  roadmap_checkin_rhythm    text,

  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.clear_plans is 'One CLEAR reflection cycle per focus area, started from an audit''s leverage-question answer. Immutable once completed, same as audits.';

create index clear_plans_user_id_idx on public.clear_plans (user_id);
create index clear_plans_audit_id_idx on public.clear_plans (audit_id);

-- ----------------------------------------------------------------------------
-- goals
-- Up to one active "primary" goal (created via CLEAR step 4) plus up to two
-- active "supporting" goals (added directly from My Goals, no CLEAR
-- required) per user at a time — enforced by trigger below, matching
-- the-aligned.com's "2 slots remaining" rule.
-- ----------------------------------------------------------------------------
create type public.goal_role as enum ('primary', 'supporting');
create type public.goal_type as enum ('take_action', 'build_habit', 'have_conversation', 'set_boundary', 'create_consistency');
create type public.goal_frequency as enum ('daily', 'three_per_week', 'weekly', 'custom');
create type public.goal_track_metric as enum ('action_completed', 'habit_done', 'confidence_score', 'self_trust_score', 'custom');
create type public.goal_status as enum ('active', 'completed', 'abandoned');

create table public.goals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  life_area_id          uuid not null references public.life_areas(id),
  clear_plan_id         uuid references public.clear_plans(id),
  role                  public.goal_role not null,
  goal_type             public.goal_type not null,
  action_text           text not null,
  frequency             public.goal_frequency not null,
  frequency_custom      text,
  success_criteria      text not null,
  track_metric          public.goal_track_metric not null,
  track_metric_custom   text,
  motivation_text       text not null,
  start_date            date not null default current_date,
  -- Always exactly 30 days out from start_date — never set independently.
  review_date           date generated always as (start_date + 30) stored,
  status                public.goal_status not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.goals is 'One row per goal — one active primary (from CLEAR) plus up to two active supporting goals per user, enforced by trigger. Immutable once no longer active.';

create index goals_user_id_idx on public.goals (user_id);

-- clear_plans.goal_id references goals, which is defined after clear_plans —
-- add the FK now that both tables exist.
alter table public.clear_plans
  add constraint clear_plans_goal_id_fkey foreign key (goal_id) references public.goals(id);

-- ----------------------------------------------------------------------------
-- checkins
-- One row per (goal, day) — the 30-Day Tracker's daily entries. Upserted by
-- the app the same way audit_responses is (one row per unique key, edited in
-- place until locked).
-- ----------------------------------------------------------------------------
create table public.checkins (
  id                 uuid primary key default gen_random_uuid(),
  goal_id            uuid not null references public.goals(id) on delete cascade,
  checkin_date       date not null default current_date,
  action_completed   boolean not null default false,
  confidence_score   smallint check (confidence_score between 1 and 10),
  self_trust_score   smallint check (self_trust_score between 1 and 10),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (goal_id, checkin_date)
);

comment on table public.checkins is 'One daily check-in per goal. Streak/completion-rate/momentum are computed from these, not stored — same reasoning as audits.total_score being the only score actually persisted.';

create index checkins_goal_id_idx on public.checkins (goal_id);

-- ============================================================================
-- Triggers
-- ============================================================================

create trigger clear_plans_set_updated_at
  before update on public.clear_plans
  for each row execute function public.set_updated_at();

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create trigger checkins_set_updated_at
  before update on public.checkins
  for each row execute function public.set_updated_at();

-- clear_plans immutability: once completed, no further edits — same rule as
-- audits, for the same reason (a coach reviewing history shouldn't find it
-- silently rewritten).
create function public.enforce_clear_plan_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' then
    raise exception 'CLEAR plan % is completed and cannot be modified — history is never overwritten', old.id
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

create trigger clear_plans_enforce_immutability
  before update on public.clear_plans
  for each row execute function public.enforce_clear_plan_immutability();

-- goals: at most one active primary + two active supporting per user -------
create function public.enforce_goal_slot_limits()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select count(*) into active_count
    from public.goals
    where user_id = new.user_id
      and role = new.role
      and status = 'active'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if new.role = 'primary' and active_count >= 1 then
    raise exception 'only one active primary goal is allowed at a time';
  end if;

  if new.role = 'supporting' and active_count >= 2 then
    raise exception 'at most two active supporting goals are allowed at a time';
  end if;

  return new;
end;
$$;

create trigger goals_enforce_slot_limits
  before insert or update on public.goals
  for each row execute function public.enforce_goal_slot_limits();

-- goals immutability: once no longer active, no further edits -------------
create function public.enforce_goal_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'active' then
    raise exception 'goal % is % and cannot be modified', old.id, old.status
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

create trigger goals_enforce_immutability
  before update on public.goals
  for each row execute function public.enforce_goal_immutability();

-- checkins: blocked once the parent goal is no longer active ---------------
create function public.enforce_checkin_immutability()
returns trigger
language plpgsql
as $$
declare
  parent_status public.goal_status;
begin
  select status into parent_status from public.goals where id = coalesce(new.goal_id, old.goal_id);

  if parent_status <> 'active' then
    raise exception 'goal % is no longer active — check-ins cannot be added or changed', coalesce(new.goal_id, old.goal_id)
      using errcode = 'raise_exception';
  end if;

  return new;
end;
$$;

create trigger checkins_enforce_immutability
  before insert or update on public.checkins
  for each row execute function public.enforce_checkin_immutability();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.clear_plans enable row level security;
alter table public.goals enable row level security;
alter table public.checkins enable row level security;

-- clear_plans: owned directly by user_id, same shape as audits' policies.
create policy "clear_plans select own"
  on public.clear_plans for select
  to authenticated
  using (user_id = auth.uid());

create policy "clear_plans insert own"
  on public.clear_plans for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "clear_plans update own"
  on public.clear_plans for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- goals: owned directly by user_id, same shape.
create policy "goals select own"
  on public.goals for select
  to authenticated
  using (user_id = auth.uid());

create policy "goals insert own"
  on public.goals for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "goals update own"
  on public.goals for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- checkins: scoped via the parent goal's ownership, same shape as
-- audit_responses' policies scoping via the parent audit.
create policy "checkins select own"
  on public.checkins for select
  to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = checkins.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "checkins insert own"
  on public.checkins for insert
  to authenticated
  with check (
    exists (
      select 1 from public.goals
      where goals.id = checkins.goal_id
        and goals.user_id = auth.uid()
    )
  );

create policy "checkins update own"
  on public.checkins for update
  to authenticated
  using (
    exists (
      select 1 from public.goals
      where goals.id = checkins.goal_id
        and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.goals
      where goals.id = checkins.goal_id
        and goals.user_id = auth.uid()
    )
  );
