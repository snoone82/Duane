-- Duane's consolidated Monthly Plan stress-test feedback (5 Sep 2026), part
-- one: the schema changes. Two unrelated gaps, both surfaced by testing
-- Daniel's real profile:
--
--   1. Tone/voice, language preferences and CTA direction have no permanent
--      home on the client record — positioning.tone_and_voice was dropped in
--      0004 as out of scope for that rebuild, and nothing replaced it. A
--      Monthly Plan was reconstructing this from nothing every month instead
--      of inheriting it, which is exactly backwards.
--   2. Platform Outputs asked the AI for a finished caption before Master
--      Content is even approved, and had no way to record what stage its
--      media is actually at.

-- ============================================================================
-- 1. content_guidelines — one row per client, mirroring brand_vision /
-- positioning exactly (same auto-provisioning trigger, same RLS shape). The
-- permanent home a Monthly Plan's synthesis fields inherit from at creation
-- (lib/actions/monthly-plans.ts createMonthlyPlan) and stay editable
-- per-month from there — never reconstructed from scratch each time.
-- ============================================================================
create table public.content_guidelines (
  client_id                 uuid primary key references public.clients(id) on delete cascade,
  secondary_objectives      text not null default '',
  tone_voice_notes          text not null default '',
  preferred_language        text not null default '',
  avoid_language            text not null default '',
  cta_priorities            text not null default '',
  primary_cta_destination   text not null default '',
  -- A hard content constraint the generation prompt must always include
  -- verbatim when set (Duane: Daniel's work involves young people in care,
  -- CSE/CCE, County Lines — content must be addressed to the professionals
  -- around them, never target young people directly, never invent cases).
  -- Free text and empty by default: most clients need nothing here, and
  -- PBOS never invents a constraint that wasn't actually set.
  content_safeguards        text not null default '',
  updated_at                timestamptz not null default now()
);

comment on column public.content_guidelines.tone_voice_notes is 'Permanent tone/voice guidance — where positioning.tone_and_voice used to live before the 0004 rebuild dropped it.';
comment on column public.content_guidelines.content_safeguards is 'A hard, non-negotiable content constraint included verbatim in every AI brief for this client when set — e.g. safeguarding rules for sensitive subject matter. Empty for the overwhelming majority of clients.';

create trigger set_updated_at before update on public.content_guidelines
  for each row execute function public.set_updated_at();

alter table public.content_guidelines enable row level security;

create policy content_guidelines_all on public.content_guidelines for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

-- No audit trigger here — client_id is the primary key (no separate id
-- column), the same shape as brand_vision / positioning, neither of which
-- is audited either (log_audit_event() requires an `id` column).

-- Same auto-provisioning as brand_vision / positioning, extending the
-- existing trigger function rather than adding a second one.
create or replace function public.create_client_defaults()
returns trigger as $$
begin
  insert into public.brand_vision (client_id) values (new.id) on conflict do nothing;
  insert into public.positioning (client_id) values (new.id) on conflict do nothing;
  insert into public.content_guidelines (client_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill every existing client — the trigger only fires on future inserts.
insert into public.content_guidelines (client_id)
select id from public.clients
on conflict do nothing;

-- ============================================================================
-- 2. Platform Outputs — the copy-behaviour change (Duane: Master Content is
-- the approval unit and carries the one full draft; a Platform Output is an
-- adaptation note, not a second finished caption to write before the idea
-- is even approved).
-- ============================================================================
alter table public.content_outputs
  add column adaptation_note text not null default '',
  add column media_state text not null default 'concept'
    check (media_state in ('concept', 'reference', 'draft', 'final'));

comment on column public.content_outputs.adaptation_note is
  'How this platform version should differ from the Master Content lead draft — e.g. "Shorten for Instagram, more conversational opening, use the video hook on screen." Not a finished caption; that is written at production time in the existing caption field.';
comment on column public.content_outputs.media_state is
  'Where this version''s media actually is: concept (not sourced yet) / reference (an example or placeholder) / draft (a rough cut) / final (ready to publish). Feeds the placeholder / content-bank / client-preview system.';
