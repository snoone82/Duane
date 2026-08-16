-- When content is sent back with changes (by the team OR by the client from
-- the portal), the linked production Action must reopen and land back with
-- its owner (Duane's workflow §2). Portal users have no UPDATE rights on
-- actions, so this runs as a SECURITY DEFINER trigger rather than app code.
create or replace function public.reopen_action_on_changes_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger reopen_action_on_changes_requested
  after update on public.content_ideas
  for each row execute function public.reopen_action_on_changes_requested();
