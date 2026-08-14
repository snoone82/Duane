-- ============================================================================
-- §17 Scorecard categories realigned to the brief's list, and the
-- contractor access tier (§23) wired into RLS for the internal/strategic
-- tables — contractors get "limited access to relevant content or tasks",
-- not the full internal picture a team member sees.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- scorecard_entries — swap the category check constraint to the brief's ten.
-- ----------------------------------------------------------------------------
alter table public.scorecard_entries drop constraint scorecard_entries_category_check;
alter table public.scorecard_entries add constraint scorecard_entries_category_check check (category in (
  'Positioning', 'Brand Clarity', 'Content Consistency', 'Audience Growth', 'Authority',
  'Engagement', 'Network', 'Commercial Impact', 'Confidence on Camera', 'Sales Effectiveness'
));

comment on table public.scorecard_entries is 'Internal only. The ten category names are also fixed in lib/scorecard.ts — keep both in sync if this list ever changes.';

-- ----------------------------------------------------------------------------
-- has_strategic_access — like has_client_access, but excludes contractors.
-- Used on the tables that hold internal/strategic information a
-- Contractor/Editor shouldn't see: vision, positioning, consultations,
-- scorecard, and both commercial tables. Contractors keep has_client_access
-- (audiences, pillars, content ideas, authority, actions, files, metrics)
-- since those are the "relevant content or tasks" the brief says they
-- should reach.
-- ----------------------------------------------------------------------------
create or replace function public.has_strategic_access(target_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.client_assignments ca
      join public.profiles p on p.id = ca.user_id
      where ca.client_id = target_client_id
        and ca.user_id = (select auth.uid())
        and p.role <> 'contractor'
    );
$$;

revoke execute on function public.has_strategic_access(uuid) from public, anon;
grant execute on function public.has_strategic_access(uuid) to authenticated;

drop policy brand_vision_all on public.brand_vision;
create policy brand_vision_all on public.brand_vision for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

drop policy positioning_all on public.positioning;
create policy positioning_all on public.positioning for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

drop policy consultations_all on public.consultations;
create policy consultations_all on public.consultations for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

drop policy scorecard_entries_all on public.scorecard_entries;
create policy scorecard_entries_all on public.scorecard_entries for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

drop policy commercial_outcomes_all on public.commercial_outcomes;
create policy commercial_outcomes_all on public.commercial_outcomes for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));

alter table public.commercial_snapshots enable row level security;
create policy commercial_snapshots_all on public.commercial_snapshots for all
  to authenticated using (public.has_strategic_access(client_id)) with check (public.has_strategic_access(client_id));
