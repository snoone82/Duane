-- Duane, reviewing the update importer before running his own profile
-- through it: a metric target said WHICH platform but not WHICH metric, so
-- LinkedIn could not hold a followers target and an impressions target at
-- the same time. Existing rows were always follower targets in practice
-- (the metrics view compares them to snapshot followers), so they default
-- to 'followers'.

alter table public.metric_targets
  add column metric text not null default 'followers' check (metric <> '');

alter table public.metric_targets
  drop constraint if exists metric_targets_client_id_platform_key;

alter table public.metric_targets
  add constraint metric_targets_client_id_platform_metric_key unique (client_id, platform, metric);

comment on column public.metric_targets.metric is
  'What is being targeted on this platform — followers | impressions | reach | engagement | profile_visits | video_views | enquiries | leads (free text, snake_case). One target per platform per metric.';
