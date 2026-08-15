-- Duane feedback batch 1: a North Star statement per client, shown at the
-- top of Overview and in the portal. One sentence of "what all of this is
-- for" — distinct from brand_vision's six structured goal fields.
alter table public.clients add column north_star text not null default '';
