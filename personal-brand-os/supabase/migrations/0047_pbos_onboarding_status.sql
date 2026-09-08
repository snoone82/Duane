-- ALTER TYPE ... ADD VALUE must commit before the new value can be
-- referenced elsewhere — kept in its own migration for exactly that reason
-- (see 0048 for everything that uses it), matching 0003/0012.
--
-- Duane's principle: "a prospect is not a client until the deal is won."
-- Once a PBOS opportunity is Won we create the client record automatically,
-- but they are NOT a delivering client yet — they are onboarding. That is a
-- real state in its own right, not a shade of 'active'.
alter type public.client_status add value 'onboarding' before 'active';
