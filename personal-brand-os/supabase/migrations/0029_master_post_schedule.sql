-- Master post schedule (Duane, 3 Sep 2026).
--
-- Same principle as master media: enter the publish date and time once at
-- the content-idea level and every platform version takes it, then amend a
-- platform individually if Instagram needs to go out at a different time
-- from LinkedIn. The column holds the master value; the propagation to
-- content_outputs.scheduled_at happens in the server action so that the
-- rules (unpublished versions only, never one already handed to Ayrshare)
-- live in one place alongside the rest of the scheduling logic.
alter table public.content_ideas
  add column scheduled_at timestamptz;

comment on column public.content_ideas.scheduled_at is
  'Master post schedule. Applied to every unpublished platform version when set; each version keeps its own scheduled_at and can be adjusted individually afterwards.';
