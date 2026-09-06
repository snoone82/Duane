-- Duane, after the first full Monthly Plan run (Sept 2026, 38 outputs):
-- publish dates were spread by pure arithmetic across every day of the
-- month, so they landed heavily on Sundays. He asked for account-level
-- posting rules rather than a Daniel-specific fix: each account says which
-- days it publishes on, PBOS spreads that account's cadence across those
-- days, and never puts more than one post per account on one day.
--
-- ISO weekday numbers: 1 = Monday … 7 = Sunday. Default Monday–Friday, so
-- every existing account behaves sensibly without anyone touching it.

alter table public.social_strategies
  add column posting_days smallint[] not null default '{1,2,3,4,5}'
    check (posting_days <@ '{1,2,3,4,5,6,7}'::smallint[] and array_length(posting_days, 1) >= 1);

comment on column public.social_strategies.posting_days is
  'ISO weekdays (1=Mon … 7=Sun) this account publishes on. assignPlanPublishDates spreads the account''s Platform Outputs across these days only, one per day; it spills onto other days only when the month has fewer matching days than outputs.';
