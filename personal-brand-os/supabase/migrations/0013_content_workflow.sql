-- ============================================================================
-- Content workflow rework, step 2 of 2: one master content record with
-- per-platform outputs underneath (Duane's "single source of truth" spec).
--   - content_outputs: one row per platform version — own copy, media,
--     schedule, status, URL and performance numbers.
--   - content_ideas: gains production fields (hook, approver, dates,
--     approval comments) and a link to its parent Action; loses the
--     single-platform columns, which migrate into an output row.
--   - actions: gains content_id link + a jsonb checklist for production steps.
--   - Portal: clients may approve / request changes on items that are
--     ready_for_approval — guarded by trigger exactly like sign-off packs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. content_outputs
-- client_id is denormalised from the master record so RLS policies and the
-- calendar query stay flat (no join inside every policy check).
-- ----------------------------------------------------------------------------
create table public.content_outputs (
  id               uuid primary key default gen_random_uuid(),
  content_id       uuid not null references public.content_ideas(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  platform         text not null,
  format           text not null default '',
  caption          text not null default '',
  cta              text not null default '',
  hashtags         text not null default '',
  media_path       text,
  thumbnail_path   text,
  destination_link text not null default '',
  status           text not null default 'pending' check (status in ('pending', 'scheduled', 'published')),
  scheduled_at     timestamptz,
  published_at     timestamptz,
  live_url         text not null default '',
  reach            integer,
  engagement       integer,
  views            integer,
  notes            text not null default '',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index content_outputs_content_id_idx on public.content_outputs (content_id);
create index content_outputs_client_id_idx on public.content_outputs (client_id);
create index content_outputs_scheduled_at_idx on public.content_outputs (scheduled_at) where scheduled_at is not null;
create trigger set_updated_at before update on public.content_outputs for each row execute function public.set_updated_at();

alter table public.content_outputs enable row level security;

create policy content_outputs_select on public.content_outputs
  for select to authenticated
  using (public.has_client_access(client_id) or public.is_portal_client_of(client_id));

create policy content_outputs_insert on public.content_outputs
  for insert to authenticated
  with check (public.has_client_access(client_id));

create policy content_outputs_update on public.content_outputs
  for update to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create policy content_outputs_delete on public.content_outputs
  for delete to authenticated
  using (public.has_client_access(client_id));

-- ----------------------------------------------------------------------------
-- 2. content_ideas production fields + Action link
-- ----------------------------------------------------------------------------
alter table public.content_ideas
  add column hook                text not null default '',
  add column approval_comments   text not null default '',
  add column approver_user_id    uuid references public.profiles(id) on delete set null,
  add column production_due_date date,
  add column target_publish_date date,
  add column action_id           uuid references public.actions(id) on delete set null;

create index content_ideas_approver_user_id_idx on public.content_ideas (approver_user_id);
create index content_ideas_action_id_idx on public.content_ideas (action_id);

-- ----------------------------------------------------------------------------
-- 3. actions: content link + production checklist
-- checklist is [{ "text": string, "done": boolean }, ...]
-- ----------------------------------------------------------------------------
alter table public.actions
  add column content_id uuid references public.content_ideas(id) on delete set null,
  add column checklist  jsonb not null default '[]'::jsonb;

create index actions_content_id_idx on public.actions (content_id);

-- ----------------------------------------------------------------------------
-- 4. Migrate legacy single-platform data into an output row, then map the
-- old statuses onto the new pipeline and drop the moved columns.
-- ----------------------------------------------------------------------------
insert into public.content_outputs
  (content_id, client_id, platform, format, live_url, reach, engagement, status, published_at)
select
  id,
  client_id,
  coalesce(nullif(platform, ''), 'General'),
  coalesce(format, ''),
  coalesce(published_url, ''),
  reach,
  engagement,
  case when status in ('published', 'measured') then 'published'
       when status = 'scheduled' then 'scheduled'
       else 'pending' end,
  case when status in ('published', 'measured') then updated_at else null end
from public.content_ideas
where platform is not null
   or published_url is not null
   or reach is not null
   or engagement is not null;

update public.content_ideas set status = 'approved_production' where status = 'approved';
update public.content_ideas set status = 'in_production' where status in ('drafted', 'created', 'edited');
update public.content_ideas set status = 'published' where status = 'measured';

alter table public.content_ideas
  drop column platform,
  drop column format,
  drop column published_url,
  drop column reach,
  drop column engagement;

-- ----------------------------------------------------------------------------
-- 5. Portal approval of final content: clients may move a ready_for_approval
-- item to ready_to_schedule (approve) or changes_requested, and write
-- approval comments — nothing else. Same guard pattern as strategy_signoffs.
-- ----------------------------------------------------------------------------
create policy content_ideas_portal_respond on public.content_ideas
  for update to authenticated
  using (public.is_portal_client_of(client_id) and status = 'ready_for_approval')
  with check (public.is_portal_client_of(client_id));

create or replace function public.enforce_content_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_client boolean;
begin
  select role = 'client' into actor_is_client
  from public.profiles where id = (select auth.uid());

  if coalesce(actor_is_client, false) then
    if old.status <> 'ready_for_approval' then
      raise exception 'This content is not awaiting your approval.';
    end if;
    if new.status not in ('ready_to_schedule', 'changes_requested') then
      raise exception 'Content can only be approved or sent back with changes.';
    end if;
    if new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.hook is distinct from old.hook
       or new.notes is distinct from old.notes
       or new.client_id is distinct from old.client_id
       or new.pillar_id is distinct from old.pillar_id
       or new.audience_id is distinct from old.audience_id
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.production_due_date is distinct from old.production_due_date
       or new.target_publish_date is distinct from old.target_publish_date
       or new.approver_user_id is distinct from old.approver_user_id
       or new.action_id is distinct from old.action_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Only the approval decision and comments can be changed.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_content_approval_transition() from public, anon, authenticated;

create trigger enforce_content_approval_transition
  before update on public.content_ideas
  for each row execute function public.enforce_content_approval_transition();
