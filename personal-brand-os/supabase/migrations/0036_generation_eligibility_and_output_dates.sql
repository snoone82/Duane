-- Duane's final tightening pass before running Daniel's generation for
-- real. Two schema gaps it exposed:
--
--   1. An audience can be real and strategically important without being
--      one PBOS should offer as a direct commercial target — Daniel's
--      "young people requiring confidence, direction and mentoring" stays
--      on his profile, but the AI must never be offered it as a selectable
--      audience_id for these commercial channels.
--   2. Publish dates were assigned per Master Content idea, so two sibling
--      Platform Outputs under the same idea (e.g. LinkedIn — Daniel Andrews
--      and LinkedIn — CEG) always landed on the identical day. Spacing
--      siblings apart needs a date per output, not per idea.

alter table public.audiences
  add column eligible_for_generation boolean not null default true;

comment on column public.audiences.eligible_for_generation is
  'Offered to the AI as a selectable audience_id when generating a Monthly Plan. false keeps the audience on the strategic profile without it ever being proposed as a direct target — never a delete, never hidden from the human-facing UI.';

alter table public.content_outputs
  add column target_publish_date date;

comment on column public.content_outputs.target_publish_date is
  'PBOS-assigned planning-stage date (assignPlanPublishDates), distinct from scheduled_at — which is only set once a version is genuinely on the publishing calendar. Lets sibling outputs under one Master Content idea (e.g. two LinkedIn accounts) land on different days instead of sharing the idea''s single target date.';
