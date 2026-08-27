-- ============================================================================
-- Duane batch 9: clients can submit their own content ideas from the portal
-- and keep editing them until the team picks them up.
--
-- Rules, enforced in the database rather than the UI:
--   * a portal account may INSERT an idea only for their own client, only at
--     status 'idea', and only stamped as its creator;
--   * they may UPDATE an idea they created, only while it is still 'idea',
--     and only its title / body / notes;
--   * the moment the team moves it into production it becomes read-only to
--     them — the existing approval path is untouched.
-- ============================================================================

create policy content_ideas_portal_insert on public.content_ideas
  for insert to authenticated
  with check (
    public.is_portal_client_of(client_id)
    and status = 'idea'
    and created_by = (select auth.uid())
  );

create policy content_ideas_portal_edit_own on public.content_ideas
  for update to authenticated
  using (
    public.is_portal_client_of(client_id)
    and status = 'idea'
    and created_by = (select auth.uid())
  )
  with check (public.is_portal_client_of(client_id) and status = 'idea');

-- The approval guard gains a second branch for client-authored drafts.
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

  if not coalesce(actor_is_client, false) then
    return new;
  end if;

  -- Branch 1: the client editing their own draft idea.
  if old.status = 'idea' and old.created_by = (select auth.uid()) then
    if new.status is distinct from old.status then
      raise exception 'The team moves ideas through the pipeline.';
    end if;
    if new.client_id is distinct from old.client_id
       or new.pillar_id is distinct from old.pillar_id
       or new.audience_id is distinct from old.audience_id
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.production_due_date is distinct from old.production_due_date
       or new.target_publish_date is distinct from old.target_publish_date
       or new.approver_user_id is distinct from old.approver_user_id
       or new.action_id is distinct from old.action_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Only the title, copy and notes can be changed.';
    end if;
    return new;
  end if;

  -- Branch 2: the approval decision (unchanged).
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
  return new;
end;
$$;
