-- ============================================================================
-- Advisor-driven hardening pass.
--
-- Applied against a real, live project (not guessed) via get_advisors after
-- 0001 ran — this consolidates three live fixes into the single migration a
-- fresh install should actually run. Findings and reasoning:
-- ============================================================================

-- 1. function_search_path_mutable — set_updated_at was the one trigger
-- function missing the pinned search_path every other function already had.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. anon/authenticated_security_definer_function_executable — Postgres
-- grants EXECUTE to PUBLIC by default at function-creation time, and
-- Supabase's default privileges on the public schema ALSO grant EXECUTE
-- directly to `anon`/`authenticated` (separate from the PUBLIC grant) — so
-- both need revoking, not just PUBLIC, to actually close this off.
--
-- is_admin()/has_client_access() should stay callable by `authenticated`
-- (RLS policies invoke them as the querying role — that grant is
-- intentional and expected to still show up in advisors) but never by
-- `anon`. The four `returns trigger` functions should not be directly
-- callable by anyone — they only run as triggers, which doesn't require a
-- role-level EXECUTE grant, and firing a trigger isn't subject to the same
-- per-role EXECUTE check as a direct function call.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.has_client_access(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_client_access(uuid) to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_role_self_escalation() from public, anon, authenticated;
revoke execute on function public.assign_creator_to_client() from public, anon, authenticated;
revoke execute on function public.create_client_defaults() from public, anon, authenticated;

-- 3. unindexed_foreign_keys — client_id is the column has_client_access()
-- filters nearly every query by; the rest are lower-traffic but still
-- flagged FK lookups worth covering now rather than after they start
-- showing up in query plans.
create index if not exists audiences_client_id_idx on public.audiences (client_id);
create index if not exists brand_pillars_client_id_idx on public.brand_pillars (client_id);
create index if not exists client_files_client_id_idx on public.client_files (client_id);
create index if not exists commercial_outcomes_client_id_idx on public.commercial_outcomes (client_id);
create index if not exists consultations_client_id_idx on public.consultations (client_id);
create index if not exists actions_consultation_id_idx on public.actions (consultation_id);
create index if not exists actions_owner_user_id_idx on public.actions (owner_user_id);
create index if not exists client_assignments_user_id_idx on public.client_assignments (user_id);
create index if not exists client_files_uploaded_by_idx on public.client_files (uploaded_by);
create index if not exists clients_created_by_idx on public.clients (created_by);
create index if not exists consultations_created_by_idx on public.consultations (created_by);
create index if not exists content_ideas_created_by_idx on public.content_ideas (created_by);
create index if not exists content_ideas_pillar_id_idx on public.content_ideas (pillar_id);

-- 4. auth_rls_initplan — wrap auth.uid() as (select auth.uid()) so Postgres
-- evaluates it once per query instead of re-evaluating it per row.
drop policy profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update
  to authenticated using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

drop policy client_assignments_select on public.client_assignments;
create policy client_assignments_select on public.client_assignments for select
  to authenticated using (user_id = (select auth.uid()) or public.is_admin());

drop policy clients_insert on public.clients;
create policy clients_insert on public.clients for insert
  to authenticated with check (exists (select 1 from public.profiles where id = (select auth.uid())));

-- 5. multiple_permissive_policies — client_assignments had a dedicated
-- SELECT policy AND a separate "for all" admin policy, so every select ran
-- both permissive policies unnecessarily. Split the admin policy into
-- insert/update/delete only so it stops overlapping with the select policy.
drop policy client_assignments_admin_write on public.client_assignments;
create policy client_assignments_admin_insert on public.client_assignments for insert
  to authenticated with check (public.is_admin());
create policy client_assignments_admin_update on public.client_assignments for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
create policy client_assignments_admin_delete on public.client_assignments for delete
  to authenticated using (public.is_admin());

-- Verified clean afterward: get_advisors (security) returns only the two
-- expected, intentional `authenticated` findings for is_admin()/
-- has_client_access() — everything else (search_path, anon exposure, the
-- four trigger functions, unindexed FKs, RLS initplan, multiple permissive
-- policies) is fully resolved. get_advisors (performance) returns only
-- "unused index" INFO notices, expected on a freshly migrated, empty
-- database — they'll stop showing up once real queries run against it.
