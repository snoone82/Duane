-- Content workflow rework, step 1 of 2 (Duane's production-schedule concept).
-- New pipeline: Idea → Approved for production → In production → Ready for
-- approval → (Changes requested) → Ready to schedule → Scheduled → Published.
-- Enum values must be committed before they can be used, so the additions
-- live in their own migration; 0013 does the data migration and new tables.
-- Legacy values (approved/drafted/created/edited/measured) stay in the type
-- — Postgres can't remove enum values — but the UI no longer offers them.

alter type public.content_status add value if not exists 'approved_production';
alter type public.content_status add value if not exists 'in_production';
alter type public.content_status add value if not exists 'ready_for_approval';
alter type public.content_status add value if not exists 'changes_requested';
alter type public.content_status add value if not exists 'ready_to_schedule';
