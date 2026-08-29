-- Client-connected social accounts (Duane's brief, 29 Aug 2026).
--
-- The client links their own LinkedIn/Instagram/TikTok/etc. from their
-- portal, through Ayrshare's own authorisation flow. Aligned Media never
-- handles a social password, and PBOS never stores one.
--
-- Migration 0019 deliberately gave ayrshare_profiles a team-only policy.
-- That was right when only the team linked accounts; it now has to admit
-- the client whose accounts these actually are. The access is narrow:
--
--   * scoped to their own client, like every other portal read
--   * gated on a new 'connect_social' permission, off by default for team
--     members (the principal bypasses it, as with every portal_can check)
--   * SELECT and INSERT only — a portal user can start a connection but
--     can't rename or delete one
--
-- profile_key stays out of every portal-facing query: the connect URL is
-- built in a server action and only the URL reaches the browser. The key is
-- an Ayrshare identifier, not a credential — posting also requires the
-- account API key, which lives in the environment and never in this table.

create policy ayrshare_profiles_portal_select on public.ayrshare_profiles for select
  to authenticated
  using (public.portal_can(client_id, 'connect_social'));

create policy ayrshare_profiles_portal_insert on public.ayrshare_profiles for insert
  to authenticated
  with check (public.portal_can(client_id, 'connect_social'));

-- The client's own accounts are theirs to see and to link. Reading the
-- social account rows is already allowed for portal users; publishing
-- fields (ayrshare_platform, ayrshare_profile_id) are set by the connect
-- flow, so the portal needs to be able to write just those two columns.
create policy social_strategies_portal_connect on public.social_strategies for update
  to authenticated
  using (public.portal_can(client_id, 'connect_social'))
  with check (public.portal_can(client_id, 'connect_social'));

-- A portal user may only ever touch the connection columns on their own
-- accounts — never the strategy, the name or the publishing switches.
create or replace function public.restrict_portal_social_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Team members with real client access are unaffected.
  if public.has_client_access(new.client_id) then
    return new;
  end if;

  if new.client_id      is distinct from old.client_id
     or new.platform    is distinct from old.platform
     or new.account_name is distinct from old.account_name
     or new.owner_brand is distinct from old.owner_brand
     or new.url         is distinct from old.url
     or new.account_type is distinct from old.account_type
     or new.account_status is distinct from old.account_status
     or new.is_primary  is distinct from old.is_primary
     or new.show_on_overview is distinct from old.show_on_overview
     or new.publishing_enabled is distinct from old.publishing_enabled
     or new.objective   is distinct from old.objective
     or new.audience    is distinct from old.audience
     or new.content_types is distinct from old.content_types
     or new.posting_frequency is distinct from old.posting_frequency
     or new.growth_strategy is distinct from old.growth_strategy
     or new.engagement_strategy is distinct from old.engagement_strategy
     or new.cta_strategy is distinct from old.cta_strategy
     or new.platform_role is distinct from old.platform_role
     or new.cadence_target is distinct from old.cadence_target
     or new.cadence_period is distinct from old.cadence_period
     or new.cross_post_rule is distinct from old.cross_post_rule
     or new.tone_voice is distinct from old.tone_voice
     or new.preferred_formats is distinct from old.preferred_formats
     or new.content_length is distinct from old.content_length
     or new.hook_guidance is distinct from old.hook_guidance
     or new.commercial_ratio is distinct from old.commercial_ratio
     or new.platform_exclusions is distinct from old.platform_exclusions
     or new.repurposing_rules is distinct from old.repurposing_rules
     or new.ai_instructions is distinct from old.ai_instructions
     or new.primary_audience_id is distinct from old.primary_audience_id
     or new.secondary_audience_id is distinct from old.secondary_audience_id
  then
    raise exception 'Client accounts can only change their own platform connection here.';
  end if;

  return new;
end;
$$;

create trigger restrict_portal_social_updates
  before update on public.social_strategies
  for each row execute function public.restrict_portal_social_updates();
