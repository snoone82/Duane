-- Master media inheritance (Duane, 3 Sep 2026).
--
-- Uploading the same clip six times, once per platform version, was the last
-- manual step in the publishing workflow. The master content idea now holds
-- the default asset and every platform version inherits it automatically
-- until one is deliberately overridden.
--
-- Deliberately the same column shape as content_outputs, so one resolver can
-- handle both and there is no second way of describing media:
--   *_path         the durable Supabase object path — this is what matters
--   *_url          a signed URL, kept only for previewing in the admin UI
--   *_source_url   externally hosted media, for anything above the upload cap
--
-- Nothing is duplicated in storage. A platform version with no media of its
-- own simply resolves to the idea's object path at publish time.

alter table public.content_ideas
  add column media_path            text,
  add column media_url             text,
  add column media_source_url      text not null default '',
  add column thumbnail_path        text,
  add column thumbnail_url         text,
  add column thumbnail_source_url  text not null default '';

comment on column public.content_ideas.media_path is
  'Master media object path in the client-files bucket. Inherited by every platform version that has no media of its own. A fresh signed URL is minted from this at publish time.';
comment on column public.content_ideas.media_source_url is
  'Externally hosted master media, for files above the upload cap. Inherited the same way.';
