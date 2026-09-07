-- What the client needs to supply for this Master Content idea (a story on
-- camera, a photo, a decision) — captured at Master Content stage and rolled
-- up by reconcilePlanRequirements into one grouped "Client input needed"
-- requirement per plan.
alter table public.content_ideas
  add column client_requirements text not null default '';
