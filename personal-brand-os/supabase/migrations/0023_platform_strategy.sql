-- Platform Strategy Profiles (Duane's brief, 29 Aug 2026).
--
-- The account record already said WHERE a client publishes and carried prose
-- strategy (objective, audience, content_types, posting_frequency,
-- cta_strategy...). What was missing is the machine-readable part: the
-- content engine could not ask "should this idea go here, how often, in what
-- form?". Agreed with Duane to extend this record rather than add a second
-- Platform Strategy table that would drift from it.
--
-- Everything defaults to a neutral state, so accounts with no strategy yet
-- behave exactly as they do today (his acceptance criterion 10).

alter table public.social_strategies
  -- The platform's job in the strategy. Free-form '' means "not stated".
  add column platform_role text not null default ''
    check (platform_role in ('', 'authority', 'discovery', 'community', 'conversion', 'commentary', 'secondary', 'long_form')),

  -- Which of the client's audiences this account actually speaks to. The
  -- prose `audience` column stays as the human description.
  add column primary_audience_id   uuid references public.audiences(id) on delete set null,
  add column secondary_audience_id uuid references public.audiences(id) on delete set null,

  -- Cadence as arithmetic, not prose. `posting_frequency` keeps the written
  -- guidance; these two make "LinkedIn 9/12 planned this month" possible.
  -- 0 = no target set, which reads as "not tracked" rather than "zero posts".
  add column cadence_target integer not null default 0 check (cadence_target >= 0),
  add column cadence_period text not null default 'week' check (cadence_period in ('week', 'month')),

  add column tone_voice          text not null default '',
  add column preferred_formats   text not null default '',
  add column content_length      text not null default '',
  add column hook_guidance       text not null default '',
  add column commercial_ratio    text not null default '',
  add column platform_exclusions text not null default '',
  add column repurposing_rules   text not null default '',

  -- The one rule the importer reads as a decision, not as guidance:
  --   allow     — the same idea may run here as-is
  --   adapt     — may run here, but the copy must be rewritten for it
  --   selective — only when it genuinely fits; propose, never assume
  --   never     — do not put ideas here from a shared master
  -- 'adapt' is the neutral default: eligible, but never a straight copy.
  add column cross_post_rule text not null default 'adapt'
    check (cross_post_rule in ('allow', 'adapt', 'selective', 'never')),

  -- Prepended to the platform's prompt whenever AI writes or adapts an
  -- output for this account.
  add column ai_instructions text not null default '';

comment on column public.social_strategies.cadence_target is
  'Target number of posts per cadence_period. 0 = no target set (not tracked in planned-vs-target).';
comment on column public.social_strategies.cross_post_rule is
  'How a master content idea may reach this account: allow | adapt | selective | never. Read by the importer when proposing a platform mix.';
comment on column public.social_strategies.ai_instructions is
  'Platform-specific instruction set applied whenever AI generates or adapts an output for this account.';

create index if not exists social_strategies_primary_audience_idx on public.social_strategies (primary_audience_id);
create index if not exists social_strategies_secondary_audience_idx on public.social_strategies (secondary_audience_id);
