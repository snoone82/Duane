-- ============================================================================
-- Aligned — fix audits.sequence_number for correct generated TypeScript types
--
-- The column had no SQL default, only a BEFORE INSERT trigger that computed
-- it — so Supabase's generated types correctly marked it as a *required*
-- field on insert, even though the app (correctly, per the brief) never
-- supplies it. Giving the column a placeholder default (always overwritten
-- by the trigger before the row is stored) makes the generated Insert type
-- accurately optional.
--
-- That requires dropping the trigger's old "reject if the client already
-- set it" guard, since a default means new.sequence_number is never NULL by
-- the time the trigger runs — the guard would now reject every single
-- insert. The trigger already recomputes and overwrites it unconditionally,
-- which is a simpler and equally effective guarantee that the client's
-- input (if any) is ignored.
-- ============================================================================

alter table public.audits alter column sequence_number set default 0;

create or replace function public.set_audit_sequence_number()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select coalesce(max(sequence_number), 0) + 1
    into new.sequence_number
    from public.audits
    where user_id = new.user_id;

  return new;
end;
$$;
