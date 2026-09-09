-- Duane, mapping the service tiers against the operator and client
-- dashboards: "Every client now needs an explicit Tier 1 / 2 / 3 / 4 field."
--
-- pbos_engagements already carries a tier, but that is the COMMERCIAL record
-- — what was sold, on what terms — and it only exists once a deal has been
-- won. A client can exist without one, and today none do: the table is
-- empty. Tier has to be answerable for every client regardless, because it
-- is going to drive portal permissions and what parts of PBOS a client can
-- operate. So it belongs on the client.
--
-- pbos_tiers.rank is already 1-4 (Self-Serve, Guided, Managed, Partner),
-- which is exactly Duane's numbering, so this references that table rather
-- than inventing a second vocabulary.
alter table public.clients
  add column tier text not null default 'partner' references public.pbos_tiers(key);

comment on column public.clients.tier is
  'The service tier this client is operated under. Drives what they can do in the portal. pbos_engagements.tier records what was sold commercially; this is what the system actually runs them as, and is the one to read for permissions.';

-- Duane: "let's treat all of our current managed clients as Tier 4".
-- Explicit rather than relying on the column default, so the intent is
-- recorded in the migration rather than inferred from it.
update public.clients set tier = 'partner';

create index clients_tier_idx on public.clients (tier);
