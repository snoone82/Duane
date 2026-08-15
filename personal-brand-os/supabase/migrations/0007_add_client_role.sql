-- Phase Two begins: the client portal role. Kept alone in this migration —
-- ALTER TYPE ... ADD VALUE must commit before the value can be referenced.
alter type public.profile_role add value 'client';