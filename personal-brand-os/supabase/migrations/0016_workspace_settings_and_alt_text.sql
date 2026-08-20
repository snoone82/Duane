-- Duane batch 3 groundwork.
--
-- 1. workspace_settings: single-row business-level settings — first use is
--    the Monthly Sales Target shown on the dashboard next to the retainer
--    total (§3 of Duane's note). Readable by the whole team, writable by
--    admins; the fixed id makes "the one row" an upsert target.
-- Team-membership helper mirroring is_admin(): true for any internal role,
-- false for portal clients. SECURITY DEFINER for the same reason as the
-- other RLS helpers; revoked from anon.
create or replace function public.is_team_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'member', 'contractor')
  );
$$;

revoke execute on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

create table public.workspace_settings (
  id                   boolean primary key default true check (id),
  monthly_sales_target numeric,
  updated_at           timestamptz not null default now()
);

create trigger set_updated_at before update on public.workspace_settings for each row execute function public.set_updated_at();

alter table public.workspace_settings enable row level security;

create policy workspace_settings_select on public.workspace_settings
  for select to authenticated
  using ((select public.is_team_member()));

create policy workspace_settings_insert on public.workspace_settings
  for insert to authenticated
  with check (public.is_admin());

create policy workspace_settings_update on public.workspace_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.workspace_settings (id) values (true);

-- 2. Publishing Pack (§5): alt text per platform version.
alter table public.content_outputs add column alt_text text not null default '';
