-- Extends the existing reopen_action_on_changes_requested trigger (0014) to
-- also keep three checklist items on the linked production Action in sync
-- with the one status transition a portal client can cause: ready_for_approval
-- -> ready_to_schedule (approve) or -> changes_requested (request changes).
--
-- Why here and not app code: portal users have no UPDATE rights on the
-- internal (non-client-visible) production Action, so portalRespondContent
-- can't do this itself — same reason the original trigger exists. Every
-- other status-driven checklist signal (draft/media/edit/schedule, and the
-- same review/approval signals reached from the team side) is kept in sync
-- by lib/actions/content.ts's syncProductionChecklist, which runs with full
-- access on every admin-authenticated write. This trigger covers only the
-- one gap that leaves.
create or replace function public.reopen_action_on_changes_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_action record;
  next_checklist jsonb;
  item jsonb;
  idx int;
  label text;
  approved_now boolean;
  changed boolean := false;
begin
  if old.status is distinct from new.status
     and old.status = 'ready_for_approval'
     and new.status in ('ready_to_schedule', 'changes_requested')
     and new.action_id is not null then
    approved_now := (new.status = 'ready_to_schedule');

    select id, checklist into target_action
    from public.actions
    where id = new.action_id and source = 'content';

    if target_action.id is not null and jsonb_typeof(target_action.checklist) = 'array' then
      next_checklist := '[]'::jsonb;
      for idx in 0 .. jsonb_array_length(target_action.checklist) - 1 loop
        item := target_action.checklist -> idx;
        label := lower(trim(both from coalesce(item->>'text', '')));
        if label in ('complete internal review', 'send for client approval') then
          if coalesce((item->>'done')::boolean, false) is distinct from true then
            item := jsonb_set(item, '{done}', 'true'::jsonb);
            changed := true;
          end if;
        elsif label = 'content approved' then
          if coalesce((item->>'done')::boolean, false) is distinct from approved_now then
            item := jsonb_set(item, '{done}', to_jsonb(approved_now));
            changed := true;
          end if;
        end if;
        next_checklist := next_checklist || jsonb_build_array(item);
      end loop;

      if changed then
        update public.actions set checklist = next_checklist where id = target_action.id;
      end if;
    end if;
  end if;

  if new.status = 'changes_requested'
     and old.status is distinct from new.status
     and new.action_id is not null then
    update public.actions
    set status = 'in_progress', completed_at = null
    where id = new.action_id and status = 'completed';
  end if;
  return new;
end;
$$;

revoke execute on function public.reopen_action_on_changes_requested() from public, anon, authenticated;
