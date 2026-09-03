-- Advisor pass after migrations 0018–0025 (run against the live project,
-- 3 Sep 2026). Two findings, both the same shape as ones fixed in 0002.
--
-- 1. anon_security_definer_function_executable — the two portal-guard
-- trigger functions were created SECURITY DEFINER (they have to be, to read
-- profiles/has_client_access on the caller's behalf) but Supabase's default
-- privileges also handed EXECUTE to anon and authenticated at creation time,
-- which exposes them at /rest/v1/rpc/. Nothing calls them directly — they
-- only ever fire as row triggers, and trigger firing doesn't go through the
-- per-role EXECUTE check — so the direct grant is pure surface area.
revoke execute on function public.restrict_portal_action_updates() from public, anon, authenticated;
revoke execute on function public.restrict_portal_social_updates() from public, anon, authenticated;

-- 2. unindexed_foreign_keys — four FKs added since 0002 without a covering
-- index. Low traffic today, but each is an ON DELETE path (profile deletion
-- has to scan them) and two are read on every assistant/sales page.
create index if not exists assistant_messages_user_id_idx on public.assistant_messages (user_id);
create index if not exists sales_opportunities_owner_user_id_idx on public.sales_opportunities (owner_user_id);
create index if not exists social_strategies_ayrshare_profile_id_idx on public.social_strategies (ayrshare_profile_id);
create index if not exists strategy_signoffs_created_by_idx on public.strategy_signoffs (created_by);
