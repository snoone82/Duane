-- Post performance pulled back from Ayrshare (Duane, 3 Sep 2026).
--
-- Jonny's content is now publishing through the platform, so the numbers
-- can come back the same way instead of being typed in. reach/engagement/
-- views already exist on content_outputs (hand-entered until now); these
-- add the counts the networks actually report, when they were last pulled,
-- and the raw response so a surprising number can be checked against what
-- Ayrshare said.
alter table public.content_outputs
  add column likes         integer,
  add column comments      integer,
  add column shares        integer,
  add column analytics_at  timestamptz,
  add column analytics_raw jsonb;

comment on column public.content_outputs.analytics_at is
  'When reach/engagement/views/likes/comments/shares were last pulled from Ayrshare. Null = hand-entered or never pulled.';
comment on column public.content_outputs.analytics_raw is
  'The analytics object Ayrshare returned for this platform on the last pull, verbatim.';
