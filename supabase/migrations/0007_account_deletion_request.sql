-- Account deletion (brief §13). This app deliberately has no service-role
-- key anywhere (see README), so there's no way for the client to actually
-- hard-delete an auth.users row itself — that needs the admin API.
-- deletion_requested_at just records the request; Duane actions the actual
-- deletion manually from the Supabase dashboard once he sees it. A real
-- self-serve delete would need a service-role-backed Edge Function, which
-- is a deliberate scope call, not an oversight — see the code comment on
-- requestAccountDeletion in app/actions/auth.ts.

alter table public.profiles
  add column deletion_requested_at timestamptz;

comment on column public.profiles.deletion_requested_at is 'Set when the user requests account deletion from /account. Actioned manually by Duane — this app has no service-role key to self-serve a hard delete.';

-- profiles has no UPDATE policy for authenticated users (writes only ever
-- happen via the security-definer auth.users-sync trigger) - deliberately,
-- so a client can never rewrite its own email/is_anonymous/full_name
-- directly. A narrow security-definer RPC, scoped to setting exactly one
-- column on exactly the caller's own row, keeps that guarantee intact
-- rather than opening a blanket "update own profile" policy just for this.

create function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
    set deletion_requested_at = now()
    where id = auth.uid();
end;
$$;

comment on function public.request_account_deletion() is 'Sets deletion_requested_at on the caller''s own profile. Duane actions the actual deletion manually — see the column comment on profiles.deletion_requested_at.';

grant execute on function public.request_account_deletion() to authenticated;
