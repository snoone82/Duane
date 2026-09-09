-- Duane, working through the client Strategy page as Jonny.
--
-- 1. Current Commercial Focus — the three lines that say what the brand is
--    working towards right now, as opposed to the North Star (where it is
--    going long term) or the monthly objective (what this month is for).
--    They sit on clients beside north_star because they are the same kind of
--    fact: client-level, changing a few times a year, not monthly.
alter table public.clients
  add column flagship_offer      text not null default '',
  add column commercial_priority text not null default '',
  add column brand_role          text not null default '';

comment on column public.clients.flagship_offer is
  'The offer the brand is currently leading with, e.g. "AI Champion to Boardroom".';
comment on column public.clients.commercial_priority is
  'What the content is being asked to achieve this quarter, e.g. "build qualified attention and information-pack sign-ups".';
comment on column public.clients.brand_role is
  'The wider authority the brand keeps building alongside the flagship offer.';

-- 2. Content & Voice Guidelines in the client's own Strategy view.
--
--    Duane: "We spent a lot of time getting the story-first rules, dictated
--    voice, CTA rules, AI-slop restrictions and safeguards right. That needs
--    to be visible so he can see what the system is actually working from."
--
--    The portal could not read this table at all. SELECT only, scoped to the
--    signed-in client's own record — the guidelines are about them, and
--    showing them is the point.
create policy content_guidelines_portal_select on public.content_guidelines
  for select
  to authenticated
  using (public.is_portal_client_of(client_id));
