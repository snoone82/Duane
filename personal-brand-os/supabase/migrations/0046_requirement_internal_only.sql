-- The sign-off deck's build notes flag this as unresolved, and it is the one
-- open item that can actually embarrass a client meeting: requirements have
-- no internal-only flag, so a note written for the team — the example given
-- was "do not name the residential location" — prints in a document
-- addressed to the client.
--
-- Default false, so nothing changes for existing rows: a requirement is
-- client-visible unless someone says otherwise. The flag is what a renderer
-- filters on, rather than each renderer inventing its own guess about which
-- wording is safe to show.
alter table public.monthly_plan_requirements
  add column internal_only boolean not null default false;

comment on column public.monthly_plan_requirements.internal_only is
  'Team-only. Excluded from the Client View and from any client-facing pack. For production notes and constraints written for the team that must never appear in a document addressed to the client.';

create index monthly_plan_requirements_client_facing_idx
  on public.monthly_plan_requirements (monthly_plan_id)
  where internal_only = false;
