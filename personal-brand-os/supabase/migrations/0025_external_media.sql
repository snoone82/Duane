-- External media on a platform version (Duane, 1 Sep 2026).
--
-- Social video doesn't fit a 50 MB upload cap — his first real clip is
-- 144.6 MB. Rather than making him compress every asset down to fit, a
-- platform version can now point at media hosted elsewhere, and publishing
-- hands that URL straight to Ayrshare as mediaUrls.
--
-- Kept deliberately separate from destination_link, which is the CTA/web
-- destination and must not double as the video asset (his words).

alter table public.content_outputs
  add column media_source_url text not null default '',
  -- A thumbnail can also live elsewhere; the uploaded thumbnail_url stays
  -- the default when both are present.
  add column thumbnail_source_url text not null default '';

comment on column public.content_outputs.media_source_url is
  'Externally hosted media (video/image) for this version. Sent to Ayrshare as mediaUrls when publishing, in preference to an uploaded media_url. Must be a direct file URL — a SharePoint/Teams share page is not one.';
comment on column public.content_outputs.thumbnail_source_url is
  'Externally hosted thumbnail. Falls back to the uploaded thumbnail_url.';
comment on column public.content_outputs.destination_link is
  'The CTA / web destination for the post. Never the media asset — see media_source_url.';
