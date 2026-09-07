-- Duane's import form asks for an optional title alongside date and type:
-- "Kickoff strategy call" reads better in a list than a bare date.
alter table public.consultations
  add column title text not null default '';

comment on column public.consultations.title is
  'Optional short name for the meeting. The date and meeting_type remain the identifying fields; this is for humans scanning the list.';
