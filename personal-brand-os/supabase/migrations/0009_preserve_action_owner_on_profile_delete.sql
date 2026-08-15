-- Deleting a team member used to fail ("Database error deleting user")
-- whenever they owned actions with no free-text owner: the FK sets
-- owner_user_id null, tripping the actions_owner_present check. Stamp the
-- departing person's name into owner_name first, so their actions survive
-- with a readable owner and the delete goes through.
create or replace function public.preserve_action_owner_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.actions
  set owner_name = coalesce(nullif(old.full_name, ''), old.email)
  where owner_user_id = old.id
    and (owner_name is null or owner_name = '');
  return old;
end;
$$;

revoke execute on function public.preserve_action_owner_name() from public, anon, authenticated;

create trigger preserve_action_owner_name
before delete on public.profiles
for each row execute function public.preserve_action_owner_name();
