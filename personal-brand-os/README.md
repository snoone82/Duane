# Personal Brand OS — Phase One

Duane Bryan's internal tool for running every personal-branding client in one place. **Separate project from "Aligned"** (the coaching audit product that lives at the root of this repository) — separate app, separate Supabase project, separate deployment, on purpose. This directory is a self-contained Next.js app; nothing here shares code, tokens, or a database with the sibling `Aligned` app one level up.

**Note on which brief this follows:** this app was first built against Aligned Media's own "Phase One" brief, then realigned field-by-field against the more detailed **"Duane Bryan Personal Brand Database" product brief** at the user's explicit instruction to treat it as authoritative. Where the two disagreed (e.g. the first brief said "no revenue charts or vanity totals" on the dashboard; this one explicitly asks for a Revenue/Retainer Overview), this one won. See "Decisions" below for the specific field-level calls made translating that brief's prose into a schema.

## Setup

### 1. Node.js

```bash
npm install
```

Two invocation quirks on this machine, both worked around already in `.claude/launch.json` and everywhere below:
- **`npx` is blocked by Group Policy** ("This program is blocked by group policy") — run tools directly instead: `node node_modules/next/dist/bin/next build`, `node node_modules/typescript/bin/tsc --noEmit`, etc.
- **`npm run <script>` is *also* blocked** the same way (it shells out through the same wrapper `npx` uses) — `node node_modules/next/dist/bin/next dev personal-brand-os --port 3010` works where `npm run dev` doesn't.

### 2. Supabase — a real, separate project already exists

Live project: **`personal-brand-os`**, ref `lqqwaybkjuqfpmodsmbf`, org ESSENN, region `eu-west-2`. All six migrations in [`supabase/migrations/`](supabase/migrations/) are applied and live, not just written — `lib/database.types.ts` is generated from the real schema, not hand-written.

**Accounts, as of this writing:**
- `snoone82@gmail.com` — created, **promoted to admin**. Can sign in at `/login` now.
- `duane@duanebryan.com` — **does not exist yet** in this project (checked directly against `auth.users`). If it was created, it likely landed in the wrong Supabase project (e.g. the sibling Aligned one) — create it fresh via **this** project's dashboard → Authentication → Users → Add user, and **set a password directly** there rather than "send invite" (a fresh project has no SMTP configured, so invite emails silently don't arrive). Once created, promote via SQL editor:
  ```sql
  update public.profiles set role = 'admin' where email = 'duane@duanebryan.com';
  ```
  Note: a `prevent_role_self_escalation` trigger blocks a plain SQL role change if it can't see an admin's session context (which a raw SQL editor session can't) — wrap the update in `alter table public.profiles disable trigger prevent_role_self_escalation;` / `... enable trigger ...` the way this session had to.
- Assigning non-admin team members to specific clients no longer needs the SQL editor — it's on each client's **Overview** tab now (admin-only "Assigned team members" section).
- Promoting someone to `member`/`contractor`/`admin` still needs the SQL editor — there's no role-management screen in phase one (see "Deliberately left out").

### 3. Environment

`.env.local` already has this project's real URL and anon key (not committed — gitignored as normal). No service-role key anywhere — every read and write goes through RLS as the signed-in user.

### 4. Types are real, not hand-written

Regenerate after any schema change:
```bash
npx supabase gen types typescript --project-id lqqwaybkjuqfpmodsmbf > lib/database.types.ts
```
The generated file doesn't export top-level `ActionStatus`/`ClientStatus`/etc. aliases — those live in [`lib/enums.ts`](lib/enums.ts) as thin re-exports of `Database["public"]["Enums"][...]`, so schema changes there don't require touching call sites.

### 5. Run it

```bash
node node_modules/next/dist/bin/next dev personal-brand-os --port 3010
```
(Port 3010, not 3000 — the sibling `Aligned` app runs on 3000 in this environment.)

## What's built — mapped to the brief's §25 MVP list

All fifteen MVP items exist, each realigned to this brief's specific field lists (not just the feature name):

1. **Secure login** (`/login`) — email/password, no public signup.
2. **Client list** (`/clients`) — sortable/filterable/searchable.
3. **Client profile** — header + eleven URL-addressable tabs, plus §4's Overview fields: contact details, location, package **and** a real numeric retainer amount, LinkedIn/website/X/Instagram/YouTube/TikTok, and (new) an **Assigned team members** section admins can manage directly on the page.
4. **Personal brand vision** — the brief's six named fields: long-term goal, desired positioning, authority goal, commercial goal, impact goal, legacy/contribution.
5. **Positioning** — the brief's eight: current positioning, desired positioning, positioning statement, expertise, unique story, differentiators, **core beliefs**, **contrarian opinions**.
6. **Audience profiles** — every field §7 asks per audience: who they are, demographics, stage, pain points, what they want, content interests, what you want them to think, what you want them to do, where they are.
7. **Content pillars** — all eight §8 fields per pillar: description, target audience, purpose, key messages, example topics, associated stories, relevant expertise, calls to action.
8. **Content ideas** — pillar/platform/**format**/**audience**/**priority** tags, the exact eight-stage pipeline from §9, plus optional reach/engagement once a piece is measured.
9. **Consultation notes** — every §13 field as its own autosaving field: meeting type, summary, client updates, wins, challenges, strategic observations, decisions made, content discussed, commercial opportunities — not one big paragraph.
10. **Actions / tasks** — the brief's four statuses (Not Started/In Progress/**Waiting**/Completed), owned by a team member or free-text (client/external supplier).
11. **Social media metrics** — all ten §15 metrics per platform per day (followers, follower growth, impressions, reach, engagement, profile visits, video views, comments, shares, saves), baseline→current→target on followers, **plus** derived Content Metrics (posts published, average reach/engagement, highest-performing content, most successful pillar) and structured Commercial Metrics (leads, enquiries, sales calls, new customers, revenue attributed, opportunities generated).
12. **Authority opportunities** — the pipeline plus **audience size** for speaking engagements.
13. **Progress timeline** — vertical, dated, highlighted milestones.
14. **File attachments** — sixteen categories close to §18's list (brand photography, video, podcast footage, logo, brand guideline, strategy document, script, content calendar, presentation, press kit, bio, headshot, testimonial, case study, plus `contract` and `other`).
15. **Search** — the exact `global_search` view query from the brief, grouped by kind.

**Beyond the MVP list, also built** because §21/§24 describe them as part of this phase's dashboard/security posture, not a later phase:
- **Dashboard** (`/`) — Active Clients count, **Monthly Retainer Total**, actions due/overdue, meetings this week, content awaiting approval, attention flags, **Opportunities** (open authority pipeline), **Client Progress** (latest scorecard average per active client), and admin-only **Recent Activity** sourced from the audit log.
- **Scorecard** — the brief's ten categories (Positioning, Brand Clarity, Content Consistency, Audience Growth, Authority, Engagement, Network, Commercial Impact, Confidence on Camera, Sales Effectiveness), 0–10, latest + previous with a movement indicator.
- **Audit log** — every insert/update/delete on clients, actions, content ideas, consultations, and authority opportunities is logged (who, what, when); admin-only, surfaced on both the dashboard and each client's Overview tab.
- **Contractor role** — a third `profile_role` alongside admin/member, with RLS that keeps them off internal/strategic tables (vision, positioning, consultations, scorecard, both commercial tables) while still reaching content/task tables for their assigned clients.
- **GDPR export/delete** — a per-client "Danger zone" (admin-only, on Overview): a full JSON export of every client-scoped table, and a real delete (cascades through the schema's foreign keys).

## Design

A genuinely different visual system from Aligned — see [`styles/design-tokens.css`](styles/design-tokens.css). Light background, near-black text, one restrained accent used only for primary actions and active states. Inter throughout. A ten-hue tag palette (`--tag-*`) backs every status pill and pipeline stage, mapped to specific stages in [`lib/status.ts`](lib/status.ts).

## Decisions made translating the brief's prose into a schema

- **`commercial_outcomes` vs `commercial_snapshots`**: the brief's §15 Commercial Metrics reads as structured periodic counts (leads, enquiries, calls, customers, revenue, opportunities) — that's `commercial_snapshots`, one row per period, upserting like `metric_snapshots` does. The original build's `commercial_outcomes` (a narrative log — "closed a $5k deal from a LinkedIn post") stayed too, since individual wins and periodic counts answer different questions and the brief's own data notes call out `commercial_outcomes` by name as an internal-only table.
- **Content Metrics has no separate entry form** — §15's "posts published, average reach, highest-performing content, most successful pillar" are all derivable from `content_ideas` rows once they reach `published`/`measured` with a `reach`/`engagement` number filled in, rather than a second place to type the same numbers twice.
- **`followers` is the one metric `metric_targets` tracks** — baseline→current→target needs one canonical number per platform; the other nine §15 metrics are point-in-time detail, shown per-platform in an expandable breakdown rather than each getting its own target.
- **Audit log is deliberately lightweight** — table/record/action/who/when, not a full before-after diff. A generic diff engine across a dozen differently-shaped tables felt like a much bigger feature than "who changed what and when," which is what §24 actually asks for.
- **`has_strategic_access()` vs `has_client_access()`** — two RLS helper functions, not one, so contractors can reach content/task tables (§23: "limited access to relevant content or tasks") while staying off vision/positioning/consultations/scorecard/both commercial tables. A contractor who's also assigned isn't blocked from seeing the client exists — just from the internal strategic layer.
- **`portal_user_id`**: still not built. Both briefs treat the client portal as a later phase; adding the column now with no policies attached seemed more likely to bit-rot than help.
- **Role management (admin/member/contractor) has no UI** — client *assignment* now does (Overview tab, admin-only), but changing what role someone holds still goes through the SQL editor. Promoting/demoting a teammate is rare enough, and risky enough, that a full user-management screen felt like scope the brief's MVP list doesn't actually ask for.

## Deliberately left out

AI features (§20, explicitly long-term) and the client portal (§22, explicitly a later phase) — nothing built or stubbed for either. Sales Strategy (§12) isn't in the brief's own MVP list (§25), so it wasn't built. Social Media *Strategy* (§10 — objectives/growth/engagement text per platform) is distinct from Social Media *Metrics* (§15, which **is** in the MVP list and **is** built) — only the metrics half exists. No "connect LinkedIn" button anywhere; metrics are explained in the UI as hand-entered, matching both briefs' explicit note that LinkedIn doesn't expose personal-profile analytics to third parties. No automated test suite yet (see "What's still unverified").

## What's been verified — and what caught real bugs

Everything below actually ran: `npm install`, `tsc --noEmit`, `eslint`, `next build`, six migrations applied to the real live project, `get_advisors` run after each schema change, real types generated from the live schema, a real dev server hit through a real browser, and a real Sign In round-trip against Supabase's Auth API.

**From the first build pass** (compiling against real APIs for the first time):
1. `@supabase/ssr` was pinned to a version written against an older `SupabaseClient` generic signature than what actually resolved — fixed by bumping the version and typing every data-layer function's `supabase` parameter as `Awaited<ReturnType<typeof createClient>>` instead of hand-reconstructing the generic. **The sibling `Aligned` app pins the same stale version** — likely has the same latent bug, not touched here.
2. The `update<Table>Field(id, field, value)` pattern's `.update()` payload didn't preserve per-column types through a dynamic field name, which either got rejected outright or silently allowed setting NOT NULL columns to `null`. Fixed with a typed `fieldPatch<UpdateType>()` helper plus an explicit nullable/non-nullable split per table.
3. `global_search`'s columns type as fully nullable even though every source column is NOT NULL (Postgres can't prove non-null through a view over `UNION ALL`) — needed a real type-guard filter, not an assertion.

**From `get_advisors` against the live, migrated project** (twice — once after the first schema, once after this realignment):
4. `SECURITY DEFINER` functions were callable by `anon` — Postgres's `PUBLIC` grant plus **Supabase's own default privileges separately granting EXECUTE to `anon`/`authenticated`** at creation time meant revoking from `PUBLIC` alone didn't close it. Also caught: unindexed foreign keys, RLS policies re-evaluating `auth.uid()` per row, and one redundant permissive-policy pair. All fixed; advisors confirmed clean afterward except the two intentional `is_admin`/`has_client_access`/`has_strategic_access` → `authenticated` findings (required for RLS itself to work).
5. **Auth leaked-password protection is disabled** on this project (an Auth setting, not something a migration can toggle) — worth enabling via Dashboard → Authentication → Policies once someone's in there; flagged, not fixed, since no tool here reaches that setting.

**Verified live in a browser** against `http://localhost:3010`: `/login` renders correctly with no console errors; a bad-credentials submission round-trips through the real Supabase Auth API and shows the correct friendly error.

## What's still unverified

- **Only one account exists** (`snoone82@gmail.com`, admin). Everything past `/login` is verified by compiling/type-checking/building, not by clicking through it signed in — that needs Duane's account created (see Setup §2) and a real walkthrough.
- **Acceptance test 9 equivalent — a non-admin team member seeing only their assigned client, and a contractor being kept off strategic tables — needs a second and third test account.** RLS bugs are exactly what a type-checker can't catch; the advisor pass checks the *policies* are well-formed, not that they produce the right *results* for a real non-admin session.
- No automated test suite yet.

## A checklist to run once real accounts exist

1. Sign in as Duane → dashboard shows real active-client count, retainer total, and counts across all panels.
2. Create a client → every tab loads, including empty ones with a helpful empty state.
3. Fill in Vision and Positioning fields (including Core Beliefs / Contrarian Opinions) → navigate away → come back → still there.
4. Add a content idea with a format/audience/priority → move through all eight statuses → each persists.
5. Add a metric snapshot with several optional fields filled in, and a target → baseline → current → target shows correctly, and the per-platform detail breakdown shows what was entered.
6. Add a consultation, fill in wins/challenges/decisions separately, and create three actions from the quick-add form → all three appear on `/actions`, the dashboard, and the client's action list with `not_started` status.
7. Log a commercial snapshot and a commercial outcome → both show in their respective sections, correctly distinct.
8. Search a word appearing in a pillar and a consultation → both come back, correctly grouped.
9. Upload a file under one of the new categories → appears in the library, downloads via signed URL.
10. **Assign a second, non-admin team member to exactly one client via that client's Overview tab. Sign in as them → confirm they see only that client, everywhere, including search and the dashboard.**
11. **Set a third account's role to `contractor` via SQL, assign them to a client → confirm they can reach Content/Audiences/Actions/Files but not Vision/Positioning/Consultations/Metrics' scorecard section.**
12. As admin, export a client's data (downloads JSON) and confirm it contains every table. Do **not** test delete against a client with real data unless you mean it.
13. Resize to 1280px → no horizontal scroll on any table.
