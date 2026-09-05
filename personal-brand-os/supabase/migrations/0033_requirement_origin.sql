-- Requirements gain an origin, so PBOS can tell a person's own entry apart
-- from one it derived itself (Duane, testing Daniel's October plan: "the
-- filming requirement must account for those six Reels" — a requirement
-- PBOS computes from the actual planned outputs, not one anybody typed in).
--
--   manual            — added by hand on the Requirements section
--   ai_import         — Claude's own requirements[], or a pillar/audience
--                        name it gave that didn't resolve to this client's
--                        approved list
--   system_generated  — computed by PBOS from the plan's current Master
--                        Content / Platform Outputs: aggregate production
--                        needs by format, a declared lead platform with no
--                        matching output, a CTA with no destination, an
--                        excluded or off-cadence platform. Recomputed on
--                        demand (lib/actions/monthly-plans.ts,
--                        reconcilePlanRequirements) — never accumulates:
--                        a condition that no longer holds has its row
--                        removed, not left stale.

alter table public.monthly_plan_requirements
  add column origin text not null default 'manual'
    check (origin in ('manual', 'ai_import', 'system_generated')),
  -- Stable identity for a system-generated row across recomputes (e.g.
  -- "format:reel", "leadplatform:<idea-id>") so reconciling updates the
  -- existing row instead of duplicating it. Null for manual/ai_import rows.
  add column generated_key text;

create index monthly_plan_requirements_generated_key_idx
  on public.monthly_plan_requirements (monthly_plan_id, generated_key)
  where generated_key is not null;
