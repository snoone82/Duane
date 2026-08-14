-- Pin search_path on the four new trigger functions from migration 0004 —
-- closes the linter's function_search_path_mutable warning. (The three
-- equivalent functions from migration 0001 predate this tightening and are
-- left as-is here; not this migration's job to touch.)

create or replace function public.enforce_clear_plan_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'completed' then
    raise exception 'CLEAR plan % is completed and cannot be modified — history is never overwritten', old.id
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_goal_slot_limits()
returns trigger
language plpgsql
set search_path = public, pg_temp
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

create or replace function public.enforce_goal_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'active' then
    raise exception 'goal % is % and cannot be modified', old.id, old.status
      using errcode = 'raise_exception';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_checkin_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
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
