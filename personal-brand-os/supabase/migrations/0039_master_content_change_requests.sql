-- Duane's three edit levels. Once a Monthly Plan is approved, its Master
-- Content is the approved version of that month: a later change to one item
-- is a change request on that item — reviewed, then applied — never a
-- silent overwrite and never a regeneration of the whole month.
--
--   kind = 'field'         one field on the item (title, hook, CTA, copy…)
--   kind = 'regeneration'  a full single-item regeneration (AI JSON payload)

create table public.master_content_change_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  monthly_plan_id  uuid not null references public.monthly_plans(id) on delete cascade,
  content_id       uuid not null references public.content_ideas(id) on delete cascade,
  kind             text not null check (kind in ('field', 'regeneration')),
  field            text not null default '',
  previous_value   text not null default '',
  proposed_value   text not null default '',
  reason           text not null default '',
  state            text not null default 'open' check (state in ('open', 'applied', 'declined')),
  requested_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_by      uuid references public.profiles(id) on delete set null,
  resolved_at      timestamptz,
  resolution_note  text not null default ''
);

create index master_content_change_requests_plan_idx on public.master_content_change_requests (monthly_plan_id, state);
create index master_content_change_requests_content_idx on public.master_content_change_requests (content_id);

alter table public.master_content_change_requests enable row level security;

create policy master_content_change_requests_all on public.master_content_change_requests for all
  to authenticated
  using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));
