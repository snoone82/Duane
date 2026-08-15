-- Outputs / Client Review & Sign-off (Duane feedback batch 1, "the
-- client-output layer"): a versioned, frozen snapshot of the agreed
-- strategy that the client reviews in the portal and approves or sends
-- back with comments. The snapshot is jsonb captured at creation time so
-- an approved pack never drifts as the live strategy keeps evolving.
create table public.strategy_signoffs (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  version           integer not null,
  title             text not null default 'Personal Brand Strategy',
  status            text not null default 'draft'
                    check (status in ('draft', 'sent', 'approved', 'changes_requested')),
  snapshot          jsonb not null,
  client_comments   text not null default '',
  approved_by_name  text not null default '',
  approved_at       timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (client_id, version)
);

create index strategy_signoffs_client_id_idx on public.strategy_signoffs (client_id);
create trigger set_updated_at before update on public.strategy_signoffs
  for each row execute function public.set_updated_at();

alter table public.strategy_signoffs enable row level security;

-- Team: strategic tier (contractors never see sign-off packs).
create policy strategy_signoffs_team_select on public.strategy_signoffs
  for select using (public.has_strategic_access(client_id));
create policy strategy_signoffs_team_insert on public.strategy_signoffs
  for insert with check (public.has_strategic_access(client_id));
create policy strategy_signoffs_team_update on public.strategy_signoffs
  for update using (public.has_strategic_access(client_id))
  with check (public.has_strategic_access(client_id));
-- History is the point: only drafts can be deleted.
create policy strategy_signoffs_team_delete on public.strategy_signoffs
  for delete using (public.has_strategic_access(client_id) and status = 'draft');

-- Portal client: sees everything except drafts; may respond to a 'sent' pack.
create policy strategy_signoffs_portal_select on public.strategy_signoffs
  for select using (public.is_portal_client_of(client_id) and status <> 'draft');
create policy strategy_signoffs_portal_update on public.strategy_signoffs
  for update using (public.is_portal_client_of(client_id) and status = 'sent')
  with check (public.is_portal_client_of(client_id));

-- A client-role user may only flip a 'sent' pack to approved/changes_requested
-- and fill the response fields — never rewrite the snapshot itself. Enforced
-- here rather than trusted to the app, since PostgREST is reachable directly.
create or replace function public.enforce_signoff_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_client boolean;
begin
  select p.role = 'client' into caller_is_client
  from public.profiles p where p.id = (select auth.uid());

  if coalesce(caller_is_client, false) then
    if old.status <> 'sent' then
      raise exception 'This pack is not awaiting your review.';
    end if;
    if new.status not in ('approved', 'changes_requested') then
      raise exception 'Respond with Approve or Request changes.';
    end if;
    if new.snapshot::text is distinct from old.snapshot::text
       or new.version is distinct from old.version
       or new.client_id is distinct from old.client_id
       or new.title is distinct from old.title
       or new.created_by is distinct from old.created_by then
      raise exception 'Only the response fields can be changed.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_signoff_response() from public, anon, authenticated;

create trigger enforce_signoff_response before update on public.strategy_signoffs
  for each row execute function public.enforce_signoff_response();
