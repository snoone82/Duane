-- Duane, after testing Production end to end: the structure is right but the
-- workflow is "far too click-heavy — I'm repeatedly entering information PBOS
-- already knows."
--
-- The production day is where shared facts belong. Set the owner and
-- approver once for the day and every asset made that day inherits them,
-- rather than being asked per item.
alter table public.production_jobs
  add column default_owner_name    text not null default '',
  add column default_approver_name text not null default '';

comment on column public.production_jobs.default_owner_name is
  'Who is producing, for the whole day. Copied onto each asset created for this job unless that asset overrides it.';
comment on column public.production_jobs.default_approver_name is
  'Who signs the day''s output off. Same inheritance as the owner.';
