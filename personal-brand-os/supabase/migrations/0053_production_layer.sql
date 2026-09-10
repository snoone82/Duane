-- Production — the missing operational layer (Duane's build note).
--
--   Content   decides what we are communicating
--   Production turns that decision into things that must be made
--   Calendar   turns the finished assets into distribution
--   Performance says what worked
--
-- The flow Duane confirmed:
--
--   Master Ideas → Production Job / Day → Production Assets → Platform Outputs
--
-- The governing rule is that Production REFERENCES the content records that
-- already exist. Captions, pillars, audiences, accounts, destination links
-- and publish dates stay where they are. Nothing here is a second copy of
-- Content — every table below holds only production-specific fields.

-- 1. A Production Job — the filming/design session itself. Has its own
--    scheduled date and time so it can appear on the existing calendar
--    alongside publishing, rather than competing with it.
create table public.production_jobs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  title           text not null,
  scheduled_at    timestamptz,
  -- The date is what the run sheet and the calendar key on; the time is
  -- optional because a filming day is often agreed before the hour is.
  production_date date not null,
  status          text not null default 'planned'
                    check (status in ('planned', 'confirmed', 'in_progress', 'complete', 'cancelled')),
  location        text not null default '',
  notes           text not null default '',
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.production_jobs is
  'A filming, photography or design session. Groups the Master Ideas being produced that day and the assets made from them. Appears on the calendar as an operational event, distinct from publishing.';

create index production_jobs_client_date_idx on public.production_jobs (client_id, production_date desc);

-- 2. Which Master Ideas are being produced on that day. A day holds several
--    ideas, and an idea can span more than one day (a shoot that overruns,
--    or stills on one day and video on another).
create table public.production_job_ideas (
  job_id     uuid not null references public.production_jobs(id) on delete cascade,
  content_id uuid not null references public.content_ideas(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (job_id, content_id)
);

comment on table public.production_job_ideas is
  'The approved Master Ideas scheduled into a production day. The run sheet is built from these — PBOS never copies the idea, it points at it.';

create index production_job_ideas_content_idx on public.production_job_ideas (content_id);

-- 3. A Production Asset — the actual thing being made. Belongs to a Master
--    Idea (its strategic parent) and usually to a job (the day it is made).
--    Holds ONLY production fields; the words that get published live on the
--    platform outputs.
create table public.production_assets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  content_id   uuid not null references public.content_ideas(id) on delete cascade,
  -- Null for an asset made outside a scheduled session — a graphic run up at
  -- a desk, a photo pulled from an archive.
  job_id       uuid references public.production_jobs(id) on delete set null,
  kind         text not null default 'video'
                 check (kind in ('video', 'clip', 'talking_head', 'photo', 'b_roll',
                                 'thumbnail', 'graphic', 'carousel', 'audio', 'written', 'other')),
  title        text not null,
  status       text not null default 'ready_to_produce'
                 check (status in ('ready_to_produce', 'in_production', 'ready_for_edit',
                                   'editing', 'ready_for_review', 'complete')),
  owner_user_id uuid references public.profiles(id) on delete set null,
  owner_name   text not null default '',
  -- The three lines a person actually reads on a shoot, and the only ones a
  -- Tier 4 client sees.
  hook         text not null default '',
  brief        text not null default '',
  finish_cta   text not null default '',
  -- Internal. Never rendered client-facing.
  production_notes text not null default '',
  -- Upload once (the existing master-media architecture): the asset holds
  -- the permanent reference and linked outputs inherit it unless a
  -- platform-specific override exists on the output.
  media_path        text,
  media_source_url  text not null default '',
  due_date     date,
  completed_at timestamptz,
  sort_order   integer not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.production_assets is
  'The physical thing being produced from a Master Idea — a talking head, b-roll, a thumbnail, a graphic. Production-specific fields only; captions and publishing detail stay on content_outputs.';

create index production_assets_client_idx on public.production_assets (client_id, status);
create index production_assets_job_idx on public.production_assets (job_id);
create index production_assets_content_idx on public.production_assets (content_id);

-- 4. Asset ↔ Platform Output, deliberately MANY-TO-MANY (Duane, future
--    -proofing): one filming job feeds Instagram, TikTok, YouTube and
--    Facebook — one shoot, four distribution outputs, not four videos to
--    film. And in the other direction one output may need several assets: a
--    video plus its thumbnail, or the several images in a carousel.
create table public.production_asset_outputs (
  asset_id  uuid not null references public.production_assets(id) on delete cascade,
  output_id uuid not null references public.content_outputs(id) on delete cascade,
  primary key (asset_id, output_id)
);

comment on table public.production_asset_outputs is
  'Which platform versions each production asset feeds. Many-to-many in both directions: one shoot can serve four platforms, and one platform version can need a video and a thumbnail.';

create index production_asset_outputs_output_idx on public.production_asset_outputs (output_id);

-- RLS. Jobs and assets are client-scoped and follow the same rule as the
-- rest of the client record. The portal gets read-only access so a Tier 4
-- client can see their production day, what is being made and its status —
-- which fields reach them is decided in the application, since owner,
-- production notes and media mappings are deliberately operator-only.
alter table public.production_jobs enable row level security;
alter table public.production_job_ideas enable row level security;
alter table public.production_assets enable row level security;
alter table public.production_asset_outputs enable row level security;

create policy production_jobs_all on public.production_jobs for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create policy production_jobs_portal_select on public.production_jobs for select
  to authenticated
  using (public.is_portal_client_of(client_id));

create policy production_assets_all on public.production_assets for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

create policy production_assets_portal_select on public.production_assets for select
  to authenticated
  using (public.is_portal_client_of(client_id));

-- The join tables carry no client_id of their own, so they inherit access
-- from the job / asset they belong to rather than repeating the rule.
create policy production_job_ideas_all on public.production_job_ideas for all
  to authenticated
  using (exists (select 1 from public.production_jobs j where j.id = job_id and public.has_client_access(j.client_id)))
  with check (exists (select 1 from public.production_jobs j where j.id = job_id and public.has_client_access(j.client_id)));

create policy production_job_ideas_portal_select on public.production_job_ideas for select
  to authenticated
  using (exists (select 1 from public.production_jobs j where j.id = job_id and public.is_portal_client_of(j.client_id)));

create policy production_asset_outputs_all on public.production_asset_outputs for all
  to authenticated
  using (exists (select 1 from public.production_assets a where a.id = asset_id and public.has_client_access(a.client_id)))
  with check (exists (select 1 from public.production_assets a where a.id = asset_id and public.has_client_access(a.client_id)));

create policy production_asset_outputs_portal_select on public.production_asset_outputs for select
  to authenticated
  using (exists (select 1 from public.production_assets a where a.id = asset_id and public.is_portal_client_of(a.client_id)));
