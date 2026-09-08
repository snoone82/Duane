-- ============================================================================
-- Found while rehearsing the Won → client conversion: the live
-- create_client_defaults() had drifted from 0008 and no longer inserted the
-- sales_strategy row (it creates brand_vision, positioning and
-- content_guidelines). Every client created from now on would open their
-- Sales tab and get a 404, because that page 404s when the row is missing —
-- and from this batch onwards, every client is created by winning a deal.
--
-- Restores the sales_strategy insert alongside the others, keeping the
-- content_guidelines line the live function had gained. Existing clients were
-- already backfilled by 0008; the backfill below is a belt-and-braces no-op
-- for them and covers anything created in between.
-- ============================================================================

create or replace function public.create_client_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brand_vision (client_id) values (new.id) on conflict do nothing;
  insert into public.positioning (client_id) values (new.id) on conflict do nothing;
  insert into public.content_guidelines (client_id) values (new.id) on conflict do nothing;
  insert into public.sales_strategy (client_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

insert into public.sales_strategy (client_id)
select id from public.clients on conflict do nothing;
