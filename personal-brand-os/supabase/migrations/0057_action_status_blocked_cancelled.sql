-- Duane's operational statuses for the ChatGPT agent loop.
--
-- He asked to distinguish Open / In Progress / Waiting / Blocked / Complete /
-- Cancelled. Four of those already exist under PBOS's own names --
-- not_started is Open, completed is Complete -- so only the two genuinely
-- missing states are added rather than renaming values the whole app reads.
--
-- Alone in its own migration on purpose: Postgres will not let a new enum
-- value be USED in the same transaction that adds it, so anything that
-- references 'blocked' or 'cancelled' has to land in a later one.

alter type action_status add value if not exists 'blocked';
alter type action_status add value if not exists 'cancelled';
