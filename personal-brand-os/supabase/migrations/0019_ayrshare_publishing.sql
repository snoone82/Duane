-- ============================================================================
-- Direct publishing via Ayrshare (Phase 2 pilot, feature-flagged by the
-- AYRSHARE_API_KEY env var — without it nothing renders).
--
-- Model: an Ayrshare "profile" = one identity (Daniel Andrews, CEG…) holding
-- one linked account per network. Each PBOS social account row points at the
-- profile that holds its connection plus the Ayrshare platform slug; content
-- outputs remember the Ayrshare post id so scheduled posts can be verified
-- and marked published with their live URL.
-- ============================================================================

create table public.ayrshare_profiles (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  title       text not null,
  -- The Ayrshare Profile Key. Server-side use only; useless without the
  -- account API key, which lives in the environment, never the database.
  profile_key text not null,
  ref_id      text not null default '',
  created_at  timestamptz not null default now()
);

create index ayrshare_profiles_client_id_idx on public.ayrshare_profiles (client_id);

alter table public.ayrshare_profiles enable row level security;

-- Team only — deliberately NO portal policy: portal accounts never see
-- publishing credentials or connection state.
create policy ayrshare_profiles_team_all on public.ayrshare_profiles for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

alter table public.social_strategies
  add column ayrshare_platform   text not null default '',
  add column ayrshare_profile_id uuid references public.ayrshare_profiles(id) on delete set null;

comment on column public.social_strategies.ayrshare_platform is 'Ayrshare platform slug (linkedin, instagram, facebook, twitter, tiktok, youtube, pinterest, gmb). Empty = this account does not publish via Ayrshare.';

alter table public.content_outputs
  add column ayrshare_post_id text not null default '',
  add column publish_error    text not null default '';
