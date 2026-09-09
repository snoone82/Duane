-- Applied live as "0047_portal_reads_for_client_dashboard" (2026-09-09) and
-- renumbered to 0050 afterwards: a concurrent session had already taken 0047
-- to 0049 for the PBOS/client sales separation. Ordering in the database is
-- by timestamp and is correct; this is the file sequence catching up.

-- Duane, testing PBOS as Jonny: the client dashboard should be a control
-- centre — what needs you, what's coming, and whether it's working — rather
-- than a system status page.
--
-- Two of those need data the portal currently cannot read at all. Both
-- policies below are SELECT-only and scoped to the signed-in portal client's
-- own record; nothing gains write access.

-- 1. Requirements — so "Needs your attention" can auto-populate with the
--    filming input, assets and decisions actually waiting on the client,
--    instead of only actions and approvals.
--
--    The internal_only test is in the POLICY, not in application code. A
--    requirement written for the team ("do not name the residential
--    location") is then unreadable by the client rather than merely
--    unrendered — the guarantee holds even if a future query forgets to
--    filter.
create policy monthly_plan_requirements_portal_select on public.monthly_plan_requirements
  for select
  to authenticated
  using (public.is_portal_client_of(client_id) and internal_only = false);

-- 2. Commercial outcomes — the client's own results. This is what makes
--    "website sign-ups / leads" on the dashboard real: the conversion data
--    Ayrshare cannot know, recorded in PBOS and shown back to the person it
--    belongs to. Which portal members see it is gated by view_progress in
--    the application, as with milestones.
create policy commercial_outcomes_portal_select on public.commercial_outcomes
  for select
  to authenticated
  using (public.is_portal_client_of(client_id));
