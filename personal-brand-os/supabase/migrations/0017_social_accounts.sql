-- Multi-account Social structure (Duane, Daniel Andrews profile): the
-- Social tab becomes the single source of truth for social accounts. One
-- client can hold several accounts on the same platform (LinkedIn — Daniel
-- Andrews AND LinkedIn — CEG), the Overview *displays* selected Social
-- records instead of keeping its own copies of the URLs, and content
-- platform versions can point at the actual publishing account.

-- 1. Account fields on social_strategies.
alter table public.social_strategies
  add column account_name       text not null default '',
  add column owner_brand        text not null default '',
  add column url                text not null default '',
  add column account_type       text not null default '' check (account_type in ('', 'personal', 'company', 'programme')),
  add column account_status     text not null default 'active' check (account_status in ('active', 'planned', 'inactive')),
  add column is_primary         boolean not null default false,
  add column show_on_overview   boolean not null default true,
  add column publishing_enabled boolean not null default true;

-- 2. Several accounts per platform are now the point — drop the
-- one-per-platform restriction from 0008.
alter table public.social_strategies drop constraint social_strategies_client_id_platform_key;

-- 3. Content platform versions can name their publishing account.
alter table public.content_outputs
  add column social_account_id uuid references public.social_strategies(id) on delete set null;
create index content_outputs_social_account_id_idx on public.content_outputs (social_account_id);

-- 4. Migrate the Overview's fixed URL fields into Social records — the
-- single-source-of-truth rule. Each populated URL becomes (or fills in) the
-- matching platform's record; single-account clients' accounts are their
-- primary accounts by definition. website_url stays on clients (not a
-- social publishing account, per Duane).
do $$
declare
  c record;
  entry record;
begin
  for c in select id, linkedin_url, instagram_url, twitter_url, youtube_url, tiktok_url from public.clients loop
    for entry in
      select * from (values
        ('LinkedIn', c.linkedin_url),
        ('Instagram', c.instagram_url),
        ('X / Twitter', c.twitter_url),
        ('YouTube', c.youtube_url),
        ('TikTok', c.tiktok_url)
      ) as v(platform, url)
      where v.url is not null and v.url <> ''
    loop
      if exists (
        select 1 from public.social_strategies s
        where s.client_id = c.id and lower(s.platform) = lower(entry.platform)
      ) then
        update public.social_strategies
        set url = case when url = '' then entry.url else url end,
            is_primary = true
        where client_id = c.id and lower(platform) = lower(entry.platform);
      else
        insert into public.social_strategies (client_id, platform, url, is_primary, show_on_overview)
        values (c.id, entry.platform, entry.url, true, true);
      end if;
    end loop;
  end loop;
end $$;

-- 5. Retire the duplicated columns.
alter table public.clients
  drop column linkedin_url,
  drop column instagram_url,
  drop column twitter_url,
  drop column youtube_url,
  drop column tiktok_url;
