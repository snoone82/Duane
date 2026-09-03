-- Follow-on from the 0026 advisor pass: the same default-grant problem, on a
-- view rather than a function.
--
-- portal_meeting_summaries exposes a narrow, safe subset of consultations to
-- portal clients, and its own WHERE clause (portal_can(client_id,
-- 'view_meetings')) does the filtering — the read path is sound, and the
-- advisor's SECURITY DEFINER finding on it is expected: consultations are
-- internal-only, so the view has to bypass that table's RLS in order to show
-- a client their own meeting summaries at all.
--
-- What wasn't intended: Supabase's default grants also handed anon and
-- authenticated INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER on
-- it. It is a simple single-table view, so Postgres treats it as
-- auto-updatable — those grants are a write path into consultations that
-- does not go through that table's own RLS. Nothing uses them; the view
-- exists to be read.
--
-- anon loses everything (an anonymous caller has no auth.uid(), so
-- portal_can is false for every row and it could never read one anyway);
-- authenticated keeps SELECT and nothing else.

revoke all on public.portal_meeting_summaries from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.portal_meeting_summaries from authenticated;

grant select on public.portal_meeting_summaries to authenticated;
