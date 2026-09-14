-- Stop PBOS forgetting that it already handed a post to Ayrshare.
--
-- Jonny's LinkedIn posts went out twice because sendOutputToAyrshare
-- overwrote ayrshare_post_id with the id of the second post. The first post
-- was still live in Ayrshare's queue and still fired, but PBOS no longer held
-- its id, so nothing could see the duplicate, cancel it, or even prove it
-- happened.
--
-- History is kept as jsonb on the row rather than in a new table: it inherits
-- content_outputs' existing RLS exactly, and it is only ever read alongside
-- the output it belongs to.

alter table public.content_outputs
  add column if not exists ayrshare_history jsonb not null default '[]'::jsonb,
  add column if not exists ayrshare_checked_at timestamptz;

comment on column public.content_outputs.ayrshare_history is
  'Every handover to Ayrshare, oldest first. Entries: {post_id, sent_at, mode: scheduled|immediate, scheduled_for, outcome: live|cancelled|superseded|null, closed_at}. Append-only — a post id is never overwritten or removed.';

comment on column public.content_outputs.ayrshare_checked_at is
  'Last time PBOS asked Ayrshare whether the handed-over post had gone out. Throttles the automatic reconcile.';

-- Backfill the current id as the first history entry so existing handovers
-- are covered by the new re-send guard rather than looking like fresh rows.
update public.content_outputs
   set ayrshare_history = jsonb_build_array(
         jsonb_build_object(
           'post_id', ayrshare_post_id,
           'sent_at', coalesce(updated_at, created_at),
           'mode', case when scheduled_at is not null then 'scheduled' else 'immediate' end,
           'scheduled_for', scheduled_at,
           'outcome', case when status = 'published' then 'live' else null end,
           'closed_at', case when status = 'published' then published_at else null end
         )
       )
 where coalesce(ayrshare_post_id, '') <> ''
   and ayrshare_history = '[]'::jsonb;
