-- The approved bio for each social account.
--
-- Duane, on the Command Centre: "I particularly want the GPT to be able to
-- read the current LinkedIn, Instagram and other social bios directly from
-- PBOS." PBOS held the account, the URL, the cadence and the whole platform
-- strategy -- but never the bio itself, so there was nothing to read. A read
-- endpoint alone could not have satisfied that ask.
--
-- bio_updated_at is separate from updated_at because the question the agent
-- needs to answer is "is this bio current?", and updated_at moves whenever
-- anything on the account changes.

alter table public.social_strategies
  add column if not exists bio text not null default '',
  add column if not exists bio_updated_at timestamptz;

comment on column public.social_strategies.bio is
  'The approved profile bio currently live on this account. Read by the agent API so content and bios can be written from the same source of truth.';
comment on column public.social_strategies.bio_updated_at is
  'When the bio itself last changed -- distinct from updated_at, which moves on any edit to the account.';

-- Stamp bio_updated_at only when the bio actually changes, so "last updated"
-- means what it says rather than tracking unrelated edits.
create or replace function public.touch_social_bio_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.bio is distinct from old.bio then
    new.bio_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists social_strategies_bio_touch on public.social_strategies;
create trigger social_strategies_bio_touch
  before update on public.social_strategies
  for each row
  execute function public.touch_social_bio_updated_at();
