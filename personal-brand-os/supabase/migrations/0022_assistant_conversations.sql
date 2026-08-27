-- ============================================================================
-- Duane batch 10: the assistant keeps its conversation.
--
-- Threads are per user per client — each person's own working conversation
-- with a client's data, which is also what keeps it safe: an answer built
-- from an admin's full strategic view can never surface in a contractor's
-- thread, because they only ever read their own rows.
-- ============================================================================

create table public.assistant_messages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index assistant_messages_thread_idx on public.assistant_messages (client_id, user_id, created_at);

alter table public.assistant_messages enable row level security;

-- Your own thread, on a client you can access. No portal policy: the
-- assistant is an internal tool.
create policy assistant_messages_own on public.assistant_messages for all
  to authenticated
  using (public.has_client_access(client_id) and user_id = (select auth.uid()))
  with check (public.has_client_access(client_id) and user_id = (select auth.uid()));
