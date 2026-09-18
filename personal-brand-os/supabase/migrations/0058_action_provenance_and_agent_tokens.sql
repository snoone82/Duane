-- Provenance on Actions, and the tokens an agent authenticates with.
--
-- Duane: "An AI-created or AI-updated action should retain enough provenance
-- for us to understand why it exists... This will eventually allow genuine
-- closed-loop monitoring rather than simply trusting a tick box."

alter table public.actions
  add column if not exists waiting_on text not null default '',
  add column if not exists source_reference text not null default '',
  add column if not exists last_checked_at timestamptz,
  add column if not exists completion_evidence text not null default '',
  add column if not exists created_by_agent boolean not null default false;

comment on column public.actions.waiting_on is
  'Who the action is waiting on when status = waiting - a person or party name, free text (Client, Duane, Steve, a supplier, a named person).';
comment on column public.actions.source_reference is
  'The identifier in the source system: an Outlook message id, meeting id, PBOS record id, content id.';
comment on column public.actions.last_checked_at is
  'When an agent last verified this action against reality. Distinct from updated_at, which moves on any write.';
comment on column public.actions.completion_evidence is
  'Why we believe it is done - user confirmed, email sent, client replied, content scheduled, content published, manually completed.';
comment on column public.actions.created_by_agent is
  'Raised by an automated agent rather than a person.';

-- The source vocabulary grows to cover where an agent actually finds things.
alter table public.actions drop constraint if exists actions_source_check;
alter table public.actions add constraint actions_source_check check (
  source = any (array[
    'manual', 'meeting', 'opportunity', 'content', 'import',
    'client_confirmation', 'signoff', 'system',
    -- Added for the agent loop
    'outlook', 'chatgpt', 'calendar', 'agent'
  ])
);

create index if not exists actions_agent_review_idx
  on public.actions (client_id, status, due_date);

-- ---------------------------------------------------------------------------
-- Agent tokens
-- ---------------------------------------------------------------------------
-- Duane: "The agent should authenticate independently rather than bypassing
-- user permissions... permissions scoped so the integration can initially
-- read clients and read/write Actions."
--
-- Only the SHA-256 of a token is stored, so the table is useless to anyone
-- who reads it - a leaked row cannot be replayed as a credential. The plain
-- token is shown once, at creation, and never again.

create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  scopes text[] not null default array['actions:read', 'actions:write', 'clients:read'],
  client_ids uuid[],
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

comment on table public.agent_tokens is
  'Bearer tokens for automated agents (ChatGPT / Work). Stores only a SHA-256 hash - the token itself is shown once at creation and is not recoverable.';

alter table public.agent_tokens enable row level security;

-- Admins manage them from PBOS. The API route reads this table with the
-- service key, which bypasses RLS by design, so no policy is needed for it.
create policy agent_tokens_admin_all on public.agent_tokens
  for all
  using (public.is_admin())
  with check (public.is_admin());
