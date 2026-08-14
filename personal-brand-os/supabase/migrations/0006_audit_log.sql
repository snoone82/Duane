-- ============================================================================
-- §24 Security: a lightweight audit log — who changed what record on which
-- client, when. Deliberately not a full diff/before-after engine (that's a
-- much bigger feature); this answers "what happened and who did it" which
-- is the baseline the brief asks for. Admin-only to read; nothing but the
-- trigger itself (running SECURITY DEFINER) can write to it.
-- ============================================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  record_id   uuid not null,
  client_id   uuid,
  action      text not null check (action in ('insert', 'update', 'delete')),
  changed_by  uuid references public.profiles(id) on delete set null,
  changed_at  timestamptz not null default now(),
  summary     text not null default ''
);

create index audit_log_client_id_idx on public.audit_log (client_id, changed_at desc);
create index audit_log_changed_by_idx on public.audit_log (changed_by);

alter table public.audit_log enable row level security;
create policy audit_log_admin_select on public.audit_log for select
  to authenticated using (public.is_admin());

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  resolved_client_id uuid;
  resolved_record_id uuid;
begin
  row_data := to_jsonb(coalesce(new, old));
  resolved_record_id := (row_data ->> 'id')::uuid;
  resolved_client_id := case
    when TG_TABLE_NAME = 'clients' then resolved_record_id
    else (row_data ->> 'client_id')::uuid
  end;

  insert into public.audit_log (table_name, record_id, client_id, action, changed_by, summary)
  values (
    TG_TABLE_NAME,
    resolved_record_id,
    resolved_client_id,
    lower(TG_OP),
    auth.uid(),
    TG_OP || ' on ' || TG_TABLE_NAME
  );

  return coalesce(new, old);
end;
$$;

revoke execute on function public.log_audit_event() from public, anon, authenticated;

create trigger audit_clients after insert or update or delete on public.clients for each row execute function public.log_audit_event();
create trigger audit_actions after insert or update or delete on public.actions for each row execute function public.log_audit_event();
create trigger audit_content_ideas after insert or update or delete on public.content_ideas for each row execute function public.log_audit_event();
create trigger audit_consultations after insert or update or delete on public.consultations for each row execute function public.log_audit_event();
create trigger audit_authority_opportunities after insert or update or delete on public.authority_opportunities for each row execute function public.log_audit_event();
