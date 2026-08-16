-- Content workflow, next slice: media assets per platform version + a
-- visible history for content records.
--
-- 1. media/thumbnail on content_outputs. The *_path columns (0013) hold the
--    storage object path; these hold ten-year signed URLs created at upload
--    time by a team member (same pattern as clients.photo_url), so portal
--    clients can preview media during approval without widening storage RLS.
alter table public.content_outputs
  add column media_url     text,
  add column thumbnail_url text;

-- 2. Audit content_outputs like every other content-bearing table.
create trigger audit_content_outputs
  after insert or update or delete on public.content_outputs
  for each row execute function public.log_audit_event();

-- 3. Richer audit summaries: name the record and, on updates, the changed
--    fields — this is what makes the history panel readable. Generic across
--    all audited tables (uses whichever label column the row has).
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
  label text;
  changed text[];
  summary_text text;
begin
  row_data := to_jsonb(coalesce(new, old));
  resolved_record_id := (row_data ->> 'id')::uuid;
  resolved_client_id := case
    when TG_TABLE_NAME = 'clients' then resolved_record_id
    else (row_data ->> 'client_id')::uuid
  end;

  label := coalesce(
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'platform', ''),
    nullif(row_data ->> 'name', ''),
    nullif(row_data ->> 'file_name', '')
  );

  if TG_OP = 'UPDATE' then
    select array_agg(n.key order by n.key) into changed
    from jsonb_each(to_jsonb(new)) as n(key, value)
    where value is distinct from (to_jsonb(old) -> n.key)
      and n.key not in ('updated_at', 'created_at');
  end if;

  summary_text := lower(TG_OP) || ' on ' || TG_TABLE_NAME
    || coalesce(' — ' || label, '')
    || case when changed is not null and array_length(changed, 1) > 0
         then ' (' || array_to_string(changed, ', ') || ')'
         else '' end;

  insert into public.audit_log (table_name, record_id, client_id, action, changed_by, summary)
  values (TG_TABLE_NAME, resolved_record_id, resolved_client_id, lower(TG_OP), auth.uid(), summary_text);

  return coalesce(new, old);
end;
$$;

revoke execute on function public.log_audit_event() from public, anon, authenticated;

-- 4. Content history is visible to anyone with access to the client (the
--    admin-only blanket policy stays for everything else — consultation and
--    commercial history remain admin-only).
create policy audit_log_content_team_select on public.audit_log
  for select to authenticated
  using (
    table_name in ('content_ideas', 'content_outputs')
    and client_id is not null
    and public.has_client_access(client_id)
  );
