# PBOS Agent API — Actions (V1)

For an authorised agent (ChatGPT / Work) to read and update PBOS Actions.
Duane's loop: *read PBOS → reason → update PBOS → check later → verify
completion → close or escalate.*

Base URL: `https://app.thealignedmedia.com`

## Connecting ChatGPT to this API

The endpoints alone do nothing — ChatGPT has to be *told they exist*. PBOS
serves its own OpenAPI description for that, from the live deployment, so it
cannot drift from the code:

    https://app.thealignedmedia.com/api/agent/openapi.json

That URL is deliberately public: ChatGPT fetches it while setting the action
up, before it holds a token, and it describes shapes rather than data.

### As a GPT Action (ChatGPT)

1. ChatGPT → **Create a GPT** → **Configure** → **Create new action**
2. **Import from URL** → paste the URL above
3. **Authentication** → **API Key** → Auth Type **Bearer** → paste a PBOS
   agent token (Team & access → Agent access)
4. Save. The four operations appear as `listActions`, `createAction`,
   `getAction`, `updateAction`.

A privacy-policy URL is only required to publish a GPT publicly; a private
one needs none.

### Worth putting in the GPT instructions

The GPT Action editor caps each operation `description` at **300 characters**,
so the operation descriptions carry only what decides *which* operation to
call. Everything else belongs here, where there is no limit — paste this into
the GPT's Instructions:

> PBOS is the permanent record of commitments. Before answering anything about
> outstanding, overdue or waiting work, read it with listActions — never answer
> from memory of this conversation.
>
> Before creating an action, search with `q=` to check it is not already there.
>
> When updating, send only the fields that changed. Setting `waiting_on` alone
> is enough to move something to waiting. When marking something complete,
> always include `completion_evidence` saying how you know — "user confirmed",
> "email sent", "client replied", "content published".
>
> If nothing has changed but you have checked, still call updateAction with no
> changes: that records the check, which is what makes "promised Friday, no
> evidence since Tuesday" answerable.
>
> For a daily review, call listActions four times: `due=today`, `due=overdue`,
> `status=waiting`, `status=blocked`.
>
> If a client name matches more than one client, PBOS returns 409 — ask which
> one rather than choosing.

### As an MCP server (ChatGPT Work, later)

Not built. When it is wanted, it wraps these same endpoints — the auth,
scoping and validation stay exactly where they are, and only the transport
differs.

## Authentication

```
Authorization: Bearer pbos_<token>
```

Create a token in PBOS → **Team & access → Agent access**. It is shown once:
only its SHA-256 hash is stored, so it cannot be recovered afterwards. Revoke
from the same panel — revocation is immediate.

Scopes on a new token: `actions:read`, `actions:write`, `clients:read`. A
token may optionally be restricted to named clients; unrestricted tokens see
every client.

### Errors

Every failure returns `{ "ok": false, "error": "<code>", "message": "<why>" }`
with a real HTTP status. Codes an agent should handle:

| Status | `error` | Meaning |
|---|---|---|
| 401 | `unauthenticated` / `unknown_token` / `revoked_token` | Token missing, wrong, or revoked |
| 403 | `missing_scope` / `client_out_of_scope` | Token isn't allowed to do that |
| 404 | `client_not_found` / `action_not_found` | Nothing matched |
| 409 | `client_ambiguous` | The name matched more than one client — ask, don't guess |
| 400 | `invalid_status` / `invalid_priority` / `invalid_date` / `title_required` / `owner_required` / `waiting_on_required` | Bad input, with the valid options in `message` |
| 503 | `not_configured` | `SUPABASE_SERVICE_ROLE_KEY` isn't set on the deployment |

## Vocabulary

**Status** — `open`, `in_progress`, `waiting`, `blocked`, `complete`,
`cancelled`. Sent and returned in these words. (`done`, `todo`, `active` and
`canceled` are also accepted on input.)

**Priority** — `low`, `medium`, `high`. `urgent` and `critical` are accepted
and stored as `high`.

**Source** — `outlook`, `chatgpt`, `calendar`, `agent`, `meeting`, `manual`,
`content`, `signoff`, `import`, `opportunity`, `client_confirmation`,
`system`. Defaults to `agent`.

**Client** — every endpoint that names a client accepts either its UUID or
its name. A name matching two clients is a `409`, never a guess.

---

## `GET /api/agent/actions`

| Query | Effect |
|---|---|
| `client` | Name or UUID |
| `status` | One status, or `open` for "anything unfinished" |
| `due` | `today`, `overdue`, or `week` (next 7 days) — each implies unfinished |
| `owner` | Partial owner name |
| `waiting_on` | Partial name of who it waits on |
| `q` | Partial action title |
| `since` | ISO timestamp — only actions changed after it |
| `limit` | 1–200, default 100 |

```json
{
  "ok": true,
  "today": "2026-09-18",
  "count": 2,
  "actions": [ { "id": "…", "title": "…", "status": "waiting", "overdue": false, … } ]
}
```

`overdue` is computed for you — due before today and not finished.

## `POST /api/agent/actions`

```json
{
  "client": "Daniel Andrews",
  "title": "Complete TikTok Business account setup",
  "description": "From Duane, 18 Sep",
  "owner": "Daniel Andrews",
  "due_date": "2026-09-18",
  "priority": "urgent",
  "status": "open",
  "source": "chatgpt",
  "source_reference": "conversation-id-or-email-id"
}
```

`client`, `title` and `owner` are required. `created_by_agent` defaults to
`true`. A `waiting` status requires `waiting_on`. Returns `201` with the
created action.

## `GET /api/agent/actions/:id`

Returns one action.

## `PATCH /api/agent/actions/:id`

Partial — anything not named is left exactly as it was, so no duplicate is
ever created. Accepts `status`, `waiting_on`, `due_date`, `priority`,
`owner`, `title`, `description`, `source`, `source_reference`,
`completion_evidence`, and `append_note`.

Behaviour worth knowing:

- `status: "complete"` stamps `completed_at`; moving off complete clears it.
- Setting `waiting_on` without a status implies `status: "waiting"`.
- Moving off `waiting` clears `waiting_on`, unless the same call sets it.
- `append_note` appends a timestamped line to the description rather than
  replacing it — provenance is meant to accumulate.
- **Every** PATCH stamps `last_checked_at`, including one that changes
  nothing else. "I looked and it hadn't moved" is the fact that makes
  *commitment at risk* answerable later.

```json
{ "status": "waiting", "waiting_on": "Daniel Andrews",
  "append_note": "Chased by email 18 Sep" }
```

---

## Security note

These routes are the only place in PBOS that uses the Supabase service-role
key, which bypasses row-level security entirely. The database is therefore
*not* what keeps one client's data away from another here — the route code
is. Every query is narrowed to the token's clients explicitly
(`assertClientAllowed` / `scopedClientIds` in `lib/agent/auth.ts`), and the
key is confined to that module, which is marked `server-only` so an
accidental import from client code fails the build rather than leaking it.

Anything added to this API must keep that discipline: scope by client in
code, every time.
