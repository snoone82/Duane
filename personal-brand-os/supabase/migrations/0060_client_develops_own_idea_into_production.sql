-- The client develops their own idea and sends it to production.
--
-- Duane, testing with Jonny: he can raise an idea but cannot progress it,
-- so the record stalls and the only way onward is for someone to recreate
-- it internally. What he wants is Add Idea -> Develop Idea -> Add media ->
-- Send to Production, on ONE record.
--
-- This deliberately revises an earlier decision. enforce_content_approval_
-- transition said, in as many words, "The team moves ideas through the
-- pipeline." That was right when a client could only write a title and some
-- notes. It is what now blocks the step, so it is amended here rather than
-- bypassed with a SECURITY DEFINER back door -- the rule stays in the
-- database where every other path already obeys it.
--
-- What a client gains: pillar, audience, and ONE forward transition,
-- idea -> approved_production. What stays internal, exactly as Duane asked:
-- dates, priority, owner, approver, the linked Action, and the client the
-- record belongs to.

create or replace function public.enforce_content_approval_transition()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  actor_is_client boolean;
begin
  select role = 'client' into actor_is_client
  from public.profiles where id = (select auth.uid());

  if not coalesce(actor_is_client, false) then
    return new;
  end if;

  -- The client's own idea, still at idea stage.
  if old.status = 'idea' and old.created_by = (select auth.uid()) then
    -- One forward transition only. Anything else -- back to idea from
    -- elsewhere, or a jump further down the pipeline -- is the team's.
    if new.status is distinct from old.status and new.status <> 'approved_production' then
      raise exception 'From here an idea can only be sent to production.';
    end if;
    -- Internal controls stay internal. pillar_id and audience_id are no
    -- longer on this list: choosing the pillar and audience is part of
    -- developing the idea, and both are validated against this client's own
    -- approved strategy by the foreign keys.
    if new.client_id is distinct from old.client_id
       or new.priority is distinct from old.priority
       or new.due_date is distinct from old.due_date
       or new.production_due_date is distinct from old.production_due_date
       or new.target_publish_date is distinct from old.target_publish_date
       or new.approver_user_id is distinct from old.approver_user_id
       or new.action_id is distinct from old.action_id
       or new.created_by is distinct from old.created_by then
      raise exception 'Dates, priority, owners and approvers are set by the team.';
    end if;
    return new;
  end if;

  -- Everything else a client may touch is the approval decision.
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

-- RLS has to allow the row to LAND on approved_production. The USING clause
-- still says status = 'idea', so this is a one-way door: once sent, the
-- client can read it but no longer edit it.
drop policy if exists content_ideas_portal_edit_own on public.content_ideas;
create policy content_ideas_portal_edit_own on public.content_ideas
  for update
  using (
    is_portal_client_of(client_id)
    and status = 'idea'
    and created_by = (select auth.uid())
  )
  with check (
    is_portal_client_of(client_id)
    and status in ('idea', 'approved_production')
    and created_by = (select auth.uid())
  );

-- Media. The storage policies were team-only (has_client_access), so a
-- client could not upload at all -- the "upload Master Media" half of the ask
-- was blocked underneath the UI.
--
-- Scoped to clients/<their client>/content/... deliberately. The same bucket
-- holds the Files tab's documents at clients/<id>/<file> and avatars at
-- clients/<id>/avatar/<file>; neither is content media and neither becomes
-- reachable here.
create policy client_files_storage_portal_insert on storage.objects
  for insert
  with check (
    bucket_id = 'client-files'
    and is_portal_client_of(((storage.foldername(name))[2])::uuid)
    and (storage.foldername(name))[3] = 'content'
  );

create policy client_files_storage_portal_select on storage.objects
  for select
  using (
    bucket_id = 'client-files'
    and is_portal_client_of(((storage.foldername(name))[2])::uuid)
    and (storage.foldername(name))[3] = 'content'
  );
