-- ALTER TYPE ... ADD VALUE / RENAME VALUE must commit before the new/renamed
-- value can be referenced elsewhere — kept in its own migration for exactly
-- that reason (see 0004 for everything that actually uses these).
alter type public.profile_role add value 'contractor';

alter type public.action_status rename value 'open' to 'not_started';
alter type public.action_status rename value 'done' to 'completed';
alter type public.action_status add value 'waiting';

create type public.content_priority as enum ('low', 'medium', 'high');
