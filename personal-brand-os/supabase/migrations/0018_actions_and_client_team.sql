-- ============================================================================
-- Duane batch 6: the Actions layer becomes the master task-management area,
-- and clients get a Client Team (client-scoped portal members with
-- permissions, assignable to Actions).
--
--  1. actions: priority, visibility (owner vs who-may-see are separate
--     concepts), source (where the task originated), portal_notes (the
--     client team's channel back).
--  2. client_members: user account → client membership → permissions.
--     Strictly client-scoped — membership rows are the ONLY bridge, so a
--     member can never reach another client by editing a URL.
--  3. is_portal_client_of() now includes active memberships, which extends
--     every existing portal read policy to members in one place.
--  4. portal_can(): the principal portal client keeps today's full portal;
--     members need the named permission flag on their membership row.
--     Meetings, content approval and strategy sign-off are gated with it.
--  5. Portal actions: SELECT honours visibility; UPDATE allowed for the
--     action's owner or (client-visible + manage_actions permission), with
--     a guard trigger restricting portal edits to status / checklist /
--     portal_notes / completed_at.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. actions: priority, visibility, source, portal notes
-- ----------------------------------------------------------------------------
alter table public.actions
  add column priority     text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  add column visibility   text not null default 'internal'
    check (visibility in ('internal', 'client')),
  add column source       text not null default 'manual'
    check (source in ('manual', 'meeting', 'opportunity', 'content', 'import', 'client_confirmation', 'signoff', 'system')),
  add column portal_notes text not null default '';

comment on column public.actions.visibility is 'internal = Aligned Media only; client = also visible in the client portal. Owner (responsibility) and visibility (who may see it) are deliberately separate.';
comment on column public.actions.portal_notes is 'Free-text notes from the client team, written through the portal — the only prose field a portal account may edit.';

-- Backfill sources for actions that predate the column.
update public.actions set source = 'content' where content_id is not null;
update public.actions set source = 'meeting' where consultation_id is not null and content_id is null;
update public.actions set source = 'client_confirmation'
  where title = 'Confirm outstanding profile details with client';

-- Every action so far has been visible in the portal Priorities view, so
-- existing rows keep that behaviour; only NEW actions default to internal.
update public.actions set visibility = 'client';

-- ----------------------------------------------------------------------------
-- 2. client_members — user account → client membership → permissions
-- ----------------------------------------------------------------------------
create table public.client_members (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  -- The linked login (profiles.role = 'client'). Null until a login is
  -- created/linked — a member can exist as a name to assign work to first.
  user_id         uuid references public.profiles(id) on delete set null,
  name            text not null,
  email           text not null default '',
  organisation    text not null default '',
  job_title       text not null default '',
  member_role     text not null default '',
  status          text not null default 'active'
    check (status in ('invited', 'active', 'disabled')),
  can_be_assigned boolean not null default true,
  -- Permission flags, e.g. {"view_actions": true, "manage_actions": true}.
  -- Known keys: view_strategy, approve_strategy, view_content,
  -- approve_content, view_actions, manage_actions, view_progress,
  -- view_meetings. Absent key = false. The principal portal client
  -- (clients.portal_user_id) bypasses these — see portal_can().
  permissions     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index client_members_client_id_idx on public.client_members (client_id);
create index client_members_user_id_idx on public.client_members (user_id);
-- One membership per login per client; unlinked (user_id null) rows are free.
create unique index client_members_client_user_key on public.client_members (client_id, user_id) where user_id is not null;
create trigger set_updated_at before update on public.client_members for each row execute function public.set_updated_at();

alter table public.client_members enable row level security;

create policy client_members_team_all on public.client_members for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

-- Portal accounts can see who's on their client's team (needed to show
-- owner names on actions) — never another client's.
create policy client_members_portal_select on public.client_members for select
  to authenticated using (public.is_portal_client_of(client_id));

-- ----------------------------------------------------------------------------
-- 3. Portal identity now includes active memberships. Every existing
--    portal read policy calls this helper, so members inherit the portal
--    surface without touching each policy — and only for their client(s).
-- ----------------------------------------------------------------------------
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
  ) or exists (
    select 1 from public.client_members
    where client_id = target_client_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. portal_can(client, permission): the principal client always may;
--    members need the flag on their membership.
-- ----------------------------------------------------------------------------
create or replace function public.portal_can(target_client_id uuid, perm text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients
    where id = target_client_id and portal_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.client_members
    where client_id = target_client_id
      and user_id = (select auth.uid())
      and status = 'active'
      and coalesce((permissions ->> perm)::boolean, false)
  );
$$;

revoke execute on function public.portal_can(uuid, text) from public, anon;
grant execute on function public.portal_can(uuid, text) to authenticated;

-- Meetings are internal by default for client team members (Duane's rule);
-- the principal client keeps them.
create or replace view public.portal_meeting_summaries
  with (security_barrier = true)
as
  select id, client_id, meeting_date, meeting_type, next_meeting_date, summary, wins
  from public.consultations
  where public.portal_can(client_id, 'view_meetings');

-- Approvals are gated too: the principal always may; members need the flag.
drop policy content_ideas_portal_respond on public.content_ideas;
create policy content_ideas_portal_respond on public.content_ideas
  for update to authenticated
  using (public.portal_can(client_id, 'approve_content') and status = 'ready_for_approval')
  with check (public.portal_can(client_id, 'approve_content'));

drop policy strategy_signoffs_portal_update on public.strategy_signoffs;
create policy strategy_signoffs_portal_update on public.strategy_signoffs
  for update using (public.portal_can(client_id, 'approve_strategy') and status = 'sent')
  with check (public.portal_can(client_id, 'approve_strategy'));

-- ----------------------------------------------------------------------------
-- 5. Portal actions: visibility-aware reads; owner/permission-scoped writes
-- ----------------------------------------------------------------------------
drop policy actions_portal_select on public.actions;
create policy actions_portal_select on public.actions for select
  to authenticated using (
    public.is_portal_client_of(client_id)
    and (
      owner_user_id = (select auth.uid())
      or (visibility = 'client' and public.portal_can(client_id, 'view_actions'))
    )
  );

create policy actions_portal_update on public.actions for update
  to authenticated
  using (
    public.is_portal_client_of(client_id)
    and (
      owner_user_id = (select auth.uid())
      or (visibility = 'client' and public.portal_can(client_id, 'manage_actions'))
    )
  )
  with check (public.is_portal_client_of(client_id));

-- Same Action record, two interfaces — but the portal side may only touch
-- status, checklist, portal_notes and completed_at. Enforced here because
-- PostgREST is reachable directly, not just through the app.
create or replace function public.restrict_portal_action_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return new; -- migrations / SQL editor
  end if;
  if exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'member', 'contractor')
  ) then
    return new;
  end if;
  if new.title           is distinct from old.title
     or new.description     is distinct from old.description
     or new.due_date        is distinct from old.due_date
     or new.owner_user_id   is distinct from old.owner_user_id
     or new.owner_name      is distinct from old.owner_name
     or new.priority        is distinct from old.priority
     or new.visibility      is distinct from old.visibility
     or new.source          is distinct from old.source
     or new.client_id       is distinct from old.client_id
     or new.content_id      is distinct from old.content_id
     or new.consultation_id is distinct from old.consultation_id then
    raise exception 'Portal accounts can update status, checklist and notes only';
  end if;
  return new;
end;
$$;

create trigger restrict_portal_action_updates
  before update on public.actions
  for each row execute function public.restrict_portal_action_updates();

-- Client-team members must be able to read their own client row — the old
-- policy only admitted the principal (portal_user_id).
drop policy clients_portal_select on public.clients;
create policy clients_portal_select on public.clients for select
  to authenticated using (public.is_portal_client_of(id));
