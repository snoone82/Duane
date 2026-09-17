-- The client edits the caption themselves; the team still owns the video.
--
-- Duane's distinction: a change to the MEDIA goes back through Request
-- changes, but a change to the COPY the client should just make. "Once the
-- client saves an edited caption, that needs to update the actual platform
-- version record — it shouldn't create a duplicate or a separate draft."
--
-- Done as a SECURITY DEFINER function rather than an RLS policy on
-- content_outputs. A policy would have to grant portal users UPDATE on the
-- whole row, and RLS cannot restrict which COLUMNS are written — so the same
-- grant that let them fix a typo would also let them change scheduled_at,
-- status or ayrshare_post_id. This writes exactly one column and nothing
-- else can be reached through it.

create or replace function public.portal_update_output_copy(
  output_id uuid,
  new_caption text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client uuid;
  parent_status content_status;
begin
  select o.client_id, ci.status
    into target_client, parent_status
  from public.content_outputs o
  join public.content_ideas ci on ci.id = o.content_id
  where o.id = output_id;

  if target_client is null then
    raise exception 'That platform version no longer exists.' using errcode = 'no_data_found';
  end if;

  -- Same capability that gates approving: if they can approve the content,
  -- they can correct the copy they are approving.
  if not public.portal_can(target_client, 'approve_content') then
    raise exception 'You do not have permission to edit this copy.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Only while it is actually theirs to review. Once approved and scheduled,
  -- the copy is what the team is working to and is no longer client-editable.
  if parent_status <> 'ready_for_approval' then
    raise exception 'This content is no longer awaiting your approval, so its copy can''t be edited here.'
      using errcode = 'check_violation';
  end if;

  update public.content_outputs
     set caption = coalesce(new_caption, '')
   where id = output_id;
end;
$$;

revoke all on function public.portal_update_output_copy(uuid, text) from public, anon;
grant execute on function public.portal_update_output_copy(uuid, text) to authenticated;
