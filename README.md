# Aligned — Phase One

The Audit: cold visitor → ten-area audit → leverage question → score reveal → account creation → results. Built to the Phase One brief.

## Setup

### 1. Node.js

This machine didn't have Node installed and winget install was blocked by
admin/UAC. Get Node.js 20+ installed (LTS), then:

```bash
npm install
```

### 2. Supabase — apply the schema

The project (`sxwmtevohcgkajouwubg`) isn't reachable from this session's
Supabase MCP connection (different org), so the migration hasn't been
applied yet. Run it yourself:

1. Open the project's **SQL Editor** in the Supabase dashboard.
2. Paste the contents of [`supabase/migrations/0001_aligned_phase_one.sql`](supabase/migrations/0001_aligned_phase_one.sql) and run it.
   This creates `life_areas`, `audits`, `audit_responses`, `profiles`, every
   trigger and RLS policy described in the brief, and seeds the ten life
   areas.
3. Go to **Authentication → Providers → Anonymous** and make sure it's
   **enabled**. Without this the app fails at the first screen.
4. (Optional but worth checking) **Authentication → Providers → Email** →
   confirm whether "Confirm email" is on. See "Decisions" below — it changes
   the account-creation experience slightly.

### 3. Environment

`.env.local` is already populated with the URL and anon key you gave me:

```
NEXT_PUBLIC_SUPABASE_URL=https://sxwmtevohcgkajouwubg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 4. Run it

```bash
npm run dev
```

## Running the tests

End-to-end coverage for the acceptance tests lives under [`e2e/`](e2e/), using
[Playwright](https://playwright.dev) (`@playwright/test`). It's the only
devDependency this pass added — everything else the suite needs
(`@supabase/supabase-js`) was already a dependency of the app itself.

1. **Install the browsers Playwright drives** (one-time, downloads Chromium
   and friends — separate from `npm install`, which only installs the test
   runner package):
   ```bash
   npm run test:e2e:install
   ```
2. **Start the app** against a real Supabase project with
   [`supabase/migrations/0001_aligned_phase_one.sql`](supabase/migrations/0001_aligned_phase_one.sql)
   and [`0002_update_life_areas_content.sql`](supabase/migrations/0002_update_life_areas_content.sql)
   applied, and **Authentication → Providers → Anonymous** enabled — same
   prerequisites as running the app at all (see "Setup" above). The suite is
   not mocked; it drives the real app against a real database.
   ```bash
   npm run dev
   ```
3. **Run the suite** (in a second terminal, dev server still running — or
   let Playwright start it for you via `webServer` in `playwright.config.ts`,
   which it will if nothing's already listening on port 3000):
   ```bash
   npm run test:e2e
   ```
   `npm run test:e2e:ui` opens Playwright's interactive UI mode instead, useful
   while writing or debugging a spec.

**What each spec file covers** (all under `e2e/`, one file per logical group
of the brief's nine acceptance tests):
- `audit-flow.spec.ts` — acceptance tests 1, 3, 4, 5: private/fresh-session
  start with no signup required, completing all ten areas + the leverage
  question with the revealed score equal to the sum of the ten satisfaction
  ratings, account creation showing results immediately with no re-entry,
  and sign-out/sign-back-in still showing everything.
- `resume.spec.ts` — acceptance test 2: answer three areas, close the tab
  (a fresh browser context seeded with the saved session, modelling "closed
  and reopened" more faithfully than reusing one in-memory page), reopen,
  resume at area four with the first three intact.
- `accessibility.spec.ts` — acceptance tests 6 and 7: a real mobile
  viewport/device with no horizontal scroll and no tap target under 44px
  across the landing, audit, leverage and score-reveal screens, and a full
  keyboard-only pass through the entire audit (Tab/Enter only) asserting
  `:focus-visible` is visible at every stop. Also has a small self-contained
  check that the new password show/hide toggle (see below) is itself
  keyboard-operable.
- `database.spec.ts` — acceptance tests 8 and 9: after a real signup, signs
  back in with a plain Supabase client (anon key, same as the app — no
  service-role key exists in this project) to confirm exactly one `audits`
  row and ten `audit_responses` rows exist, each with a satisfaction,
  importance and (correctly derived) `priority_score`; and confirms the
  database itself rejects an `importance_score` of 6.

### Actual results from the first real run (2026-08-13)

Node.js finally got installed locally, so this has now genuinely been run —
`npm install`, `tsc`, `eslint`, a manual click-through of the whole flow in a
real browser, and the full Playwright suite. Real bugs turned up and got
fixed (see git log for the full list — mistyped Supabase types causing
query results to silently collapse to `never`, a stale `@supabase/ssr`
version, a schema/type mismatch on `audits.sequence_number`, a couple of
genuine bugs in the test suite itself). Current state:

**`npm run test:e2e`: 10 of 14 passing.** All four remaining failures share
one identical cause, confirmed directly against the Supabase Auth API:

```json
{ "code": 429, "error_code": "over_email_send_rate_limit", "msg": "email rate limit exceeded" }
```

This project has **Authentication → Providers → Email → "Confirm email"**
turned on. That means every single account-creation attempt — including
every real signup once this ships — sends an actual confirmation email
through Supabase's built-in email service, which has a low default rate
limit (a handful of emails per hour). Testing today exhausted it, which is
exactly the failure mode real signup traffic would eventually hit too, not
just an artifact of automated testing.

Two things to decide, not code to write:

1. **Turn "Confirm email" off** for this flow. The app already handles the
   anonymous→permanent conversion correctly regardless of this setting —
   `is_anonymous` just won't flip to `false` until confirmed, and a
   password-based sign-in on a later device won't work until then either
   (confirmed directly: `signInWithPassword` returns "Invalid login
   credentials" for an unconfirmed account). Given the product's whole
   design is "resume seamlessly, no friction," this is the setting that
   matches that intent.
2. **Or keep it on**, but configure a custom SMTP provider (Supabase's
   dashboard has a spot for this) with real headroom before real traffic —
   the built-in email service was never meant for production volume.

Either way, this needs a deliberate choice — I'm flagging it rather than
picking one silently, per the brief's own instruction to surface exactly
this kind of thing.

## What's built

- `/` — landing, one button, resumes an in-progress audit if one exists for the current session.
- `/audit/intro` — shown once, only on a fresh start ("Continue the Audit" skips straight past it). Duane's framing for someone arriving cold: why the audit exists, "score where you genuinely are today, not where you think you should be", and a 1–10 scoring guide (1–2 "deeply out of alignment" through 9–10 "fully aligned/thriving") so a bare number has meaning before they're asked to give one. The audit itself isn't created until "Begin the Audit" is clicked here — reading the intro and leaving doesn't leave a stray in-progress row.
- `/audit` — one life area per screen, fetched from `life_areas` (never hardcoded), satisfaction (1–10, number grid) and importance (1–5, pill row — deliberately different shape) as two distinct questions, progress bar, working back navigation. Autosave on every rating change. A collapsed "Add more detail" disclosure holds four optional reflection fields (why this score, what's working, what's not, one-point move) — required by the formal brief, kept optional so the required flow stays the fast snapshot Duane's own email asked for.
- `/audit/leverage` — the ten areas as single-select options, saved on tap, now also showing a rules-based "Your recommended focus" suggestion with a written rationale and a "Use this focus" shortcut — see "Recommended Focus Area" below.
- `/audit/complete` — completes the audit (sum of the ten satisfaction scores → `total_score`, plus a computed `recommended_focus_area_id`/rationale), reveals the score, then account creation (a required consent checkbox, "I understand Duane personally reviews my responses...") that converts the anonymous user in place via `supabase.auth.updateUser` (never a second user).
- `/dashboard` — the brief's six-piece layout: Score (with a compact score-over-time list once there's more than one completed audit), Alignment Chart, Priority Focus, Current Aligned Goal, Progress, and a single dynamic Next Action that reads real state (start CLEAR → continue CLEAR → set your goal → log today's check-in → "you're on track").
- `/clear` — the CLEAR framework, five steps (Current Reality, Life Vision, Emotional Blocks, Aligned Goal, Roadmap & Review) off the leverage-question's focus area. Each reflection step quotes the person's own audit rating/answer back to them ("Based on what you told us about X — you rated it 3/10...") rather than claiming real analysis. Step 4 creates the primary `goals` row.
- `/goals` — "My Goals": the Primary Focus goal with its stats (actions done, streak, completion rate), plus up to two Supporting Goals added directly (no CLEAR required).
- `/tracker` — the 30-Day Tracker, tied directly to the active primary goal: same-day check-in (action done, confidence, self-trust, optional note) and the last 7 days at a glance.
- `/login` — not in the brief's route list, added because acceptance test 5 ("sign out, sign back in") needs somewhere to do that. Minimal email/password form, plus a "Forgot your password?" link.
- `/reset-password` and `/reset-password/confirm` — request a reset link, then set a new password. Runs on the browser Supabase client directly (the recovery session only exists client-side after the emailed link's URL fragment is processed).
- `/account` — change-password link, and "Delete my account" (records a deletion request; see "Decisions I made" for why it doesn't self-serve a hard delete).
- Sign-out button on the dashboard.
- Every table write goes through Server Actions (`app/actions/`) using the `@supabase/ssr` server client, scoped entirely by RLS — no service-role key anywhere. The one exception is `request_account_deletion`, a narrow security-definer RPC (see "Decisions I made").
- Password fields (account creation, `/login`, `/reset-password/confirm`) have a show/hide toggle — see "Polish pass" below. (An earlier soft cross-fade between audit steps was removed; see "Decisions I made" for why.)

## Phase Two — CLEAR, Goals, Tracker, Recommended Focus (per the formal AI & App Development brief)

Duane sent a much more detailed "ALIGNED — APP & AI DEVELOPMENT BRIEF" partway through this build, describing the full intended journey: `AUDIT → PROFILE → FOCUS → CLEAR → GOAL → ACTION → REVIEW → RE-AUDIT`. Everything up to and including Goals/Tracker in that list is now built (see "What's built" above) — three new tables (`clear_plans`, `goals`, `checkins`; migrations `0004`–`0007`), all with the same immutability discipline as `audits`.

**Not built, and worth being direct about why:** the brief's §3 ("The Aligned Profile") and §12 ("AI Function") describe an actual AI coaching intelligence layer — pattern recognition across audits/CLEAR/goals, an AI-recommended focus with real analysis, longitudinal narration ("you've gone from 58 to 71 since your first audit"). **None of that is built.** This app has no LLM integration anywhere. Two things stand in for it today, and both are deliberately honest about being placeholders, not the real thing:

- **Recommended Focus Area** (`lib/recommended-focus.ts`): a rules-based weighting (`importance × (10 − satisfaction)`, the same formula `priority_score` already uses), not AI. It doesn't read the written reflection answers or spot cross-area patterns.
- **CLEAR "personalization"**: each step quotes the person's own audit answer back to them (a template, filling in their real words), which reads as "based on what you told me..." without an actual model call behind it.

Both are structured so swapping in a real AI call later is an app-layer change, not a schema one — see the column comment on `audits.recommended_focus_area_id`. Building the real thing needs a provider/budget decision (which model, what it costs) that's Steven and Duane's call, not something to commit to silently.

## Production-reliability hardening

- **Error boundaries**: `app/error.tsx` (root-level, catches anything thrown while rendering a route) and `app/not-found.tsx` (unmatched routes / `notFound()`) — both reuse `Notice`/`Button`/`Logo` and the app's calm, plain-language voice, and both offer a way back to `/`. `app/global-error.tsx` additionally catches errors thrown by the root layout itself (the one place `app/error.tsx` can't reach); it has to render its own minimal `<html>/<body>` since it replaces the root layout entirely, so it can't rely on the token pipeline having loaded — colours there are hand-copied from `styles/design-tokens.css`, kept simple but still on-brand rather than a raw stack trace.
- **Loading states**: `loading.tsx` for the four route segments that fetch data before rendering (`app/audit`, `app/audit/leverage`, `app/audit/complete`, `app/dashboard`) — a shared `components/ui/Skeleton.tsx` primitive (a `bg-paper-muted` block with Tailwind's `animate-pulse`) laid out to mirror each page's real shape. It's a CSS animation, so it's already covered by the global `prefers-reduced-motion` override in `styles/design-tokens.css`.
- **Environment validation**: `lib/env.ts` validates `NEXT_PUBLIC_SUPABASE_URL` (present, parses as a URL) and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (present, JWT-shaped) at import time, throwing a specific, actionable error instead of a bare `process.env.X!` non-null assertion deferring to a confusing Supabase error later. `lib/supabase/client.ts`, `lib/supabase/server.ts` and `lib/supabase/middleware.ts` all read from it now.
- **Server Action safety net**: every exported function in `app/actions/audit.ts` and `app/actions/auth.ts` is wrapped in try/catch so an unexpected thrown exception (network failure, an unfamiliar Supabase client error) still resolves to the same typed `{ ok: false, message }` shape via `lib/errors.ts`'s friendly-error helpers, instead of throwing past the Server Action boundary and hitting the generic Next.js error page. The underlying logic is unchanged — this is purely a safety net around it. (Next's internal `NEXT_REDIRECT` signal, thrown by `redirect()`, is explicitly rethrown rather than swallowed via `lib/errors.ts`'s `isNextRedirectError` — moot today since none of these actions call `redirect()`, navigation is client-side via `router.push`, but the catch blocks guard for it in case that changes.)
- **Icons, manifest, social metadata**: `app/icon.tsx` and `app/apple-icon.tsx` generate the favicon and larger app icon from code, reusing the same spirit-level mark as `components/ui/Logo.tsx` so they can't drift out of sync. `app/manifest.ts` adds a web app manifest (name, theme/background colour pulled from the actual token values, `display: "standalone"`) so the app is installable / "Add to Home Screen" on mobile. `app/layout.tsx`'s `metadata` export now includes Open Graph and Twitter Card fields (same title/description already established, not new copy) plus a `themeColor`, so shared links render with a proper title, description and card instead of a bare URL.

**Known gap, flagged deliberately rather than silently skipped**: there's no rate-limiting or abuse-prevention on anonymous audit creation (`startOrResumeAudit` in `app/actions/audit.ts` — anyone can call it repeatedly and create unlimited anonymous users/audits). That needs a real infrastructure decision (e.g. Upstash/Redis-backed rate limiting, or a Supabase-side throttle) that shouldn't be invented speculatively here — treat it as a must-fix before real launch traffic, not an oversight.

## Polish pass — password visibility & page-transition navigation

- **Password show/hide toggle**: `components/ui/TextField.tsx` now renders a
  show/hide button automatically whenever `type="password"` (an explicit
  `showToggle={false}` opts a given field out, but nothing has needed to).
  It's a real `<button type="button">` with an `aria-label` that flips
  between "Show password" / "Hide password" — not a `div` with an `onClick`
  — so it's a native tab stop and works with Enter/Space, and sits inside
  the field's existing 44px (`--tap-target-min`) row rather than adding a
  second row. The eye / eye-off glyphs are two small inline SVGs (no icon
  library added for two icons). Both password fields in the app get this for
  free from the shared component: the account-creation field on
  `/audit/complete` (`components/audit/CompleteAuditClient.tsx`) and
  `/login`'s password field, so the two stay consistent without either page
  needing its own logic.
- **Page-transition polish between audit steps**: `lib/view-transition.ts`
  exports `navigateWithTransition(navigate)`, a thin wrapper around the
  native View Transitions API (`document.startViewTransition`) used for the
  Back/Continue navigations in `components/audit/AuditAreaClient.tsx` and the
  Continue navigation in `components/audit/LeverageClient.tsx` — i.e.
  between the ten audit-area screens, into the leverage question, and from
  the leverage question into the score reveal. It's progressively enhanced
  (feature-detected via `"startViewTransition" in document`, so unsupported
  browsers just get the plain instant navigation they already had) and
  explicitly checks `window.matchMedia("(prefers-reduced-motion: reduce)")`
  before starting a transition — the global `prefers-reduced-motion`
  override in `styles/design-tokens.css` collapses CSS animation/transition
  durations, but has no effect on the View Transitions API itself, so this
  needed its own check. The transition is a plain, calm cross-fade (see the
  `::view-transition-old(root)` / `::view-transition-new(root)` rules in
  `app/globals.css`, which only retime the browser's default cross-fade to
  match the app's `--duration-slow` / `--ease-standard` tokens) — deliberately
  not a slide or zoom. Not applied to every navigation in the app (e.g. the
  landing page's "Start the Audit" button is left alone) — it's meant to read
  as a considered touch on the core audit flow, not a blanket policy.

## Deliberately left out

CLEAR, Goals, and the Tracker are now built (see "Phase Two" above) — this list originally excluded them too, back when the brief was just the original Phase One spec. What's still genuinely out of scope:

- **A coach dashboard.** Nothing here is Duane-facing — no client list, no per-audit review UI, no notes. `session_notes` and `audit_reviews` (both named in the formal brief's table list) are untouched.
- **Real AI** — see "Phase Two" above for exactly what stands in for it today and why.

## Decisions I made that weren't specified

- **`priority_score` formula**: `importance_score * (10 - satisfaction_score)`, computed as a stored generated column (range 0–45). The brief requires the column to exist and be visible in the table editor but doesn't define the formula — this weights low-satisfaction/high-importance areas highest, which seemed like the useful triage signal for the coach. It's derived in the database and never surfaced in the app UI. Worth confirming this formula is what you actually want.
- **`profiles.is_anonymous`**: added this column (kept in sync by trigger) so the app can tell "audit completed but still anonymous" apart from "has a real account" — used to decide whether `/audit/complete` should redirect straight to `/dashboard`. Not in the brief's table list but seemed necessary to make the flow work.
- **`/login` route**: added, see above — required by acceptance test 5, not in the brief's route diagram.
- **Ten life areas seeded**: the brief says areas are content-managed and never hardcoded, but a fresh table needs *something* in it. Originally seeded with ten placeholder names, since replaced (via [`0002_update_life_areas_content.sql`](supabase/migrations/0002_update_life_areas_content.sql)) with Duane's confirmed final list: Health & Energy, Mindset & Thinking, Confidence & Self-Belief, Relationships & Connection, Career, Work & Business, Money & Stability, Purpose & Direction, Daily Structure & Discipline, Emotional Wellbeing, Self-Respect & Identity. Reword further any time from the Supabase dashboard — the app never needs a redeploy for that.
- **Existing-email signup handling**: per the brief, I did not build anonymous-to-existing-account linking (it's genuinely non-trivial — it means transferring an audit's `user_id` across accounts, which the immutability model doesn't have an obvious safe path for). When `updateUser` fails because the email's taken, the app shows a clear message and a link to `/login`, and stops there. Flagging this exactly as the brief asked, rather than inventing something.
- **Email confirmation**: if your Supabase project has "Confirm email" turned on, the new email/password is set but `is_anonymous` won't flip to `false` (and future sign-in requires their password to work either way) until they click the confirmation link. The user *does* still land straight on `/dashboard` with their results, so acceptance test 4 holds — but it's worth deciding deliberately whether that setting should be on or off for this flow.
- **`ScoreRing` is a static, non-achievement dial, not a "fill" progress ring**: a ring that fills proportionally to the score (or colour-codes by tier) reads as "you're X% of the way to a good outcome" — an achievement/progress metaphor that conflicts with the product rule that a score must never read as a verdict or grade on the person. So `components/ui/ScoreRing.tsx` draws a single complete circle whose stroke weight and colour never depend on `value` at all — it's a quiet, constant frame around the number, identical whether the score is 12 or 98. `value`/`max` only drive the centered number and the accessible label.
- **No per-area icons/initials on the leverage list**: the ten life areas are pure database content (`getLifeAreas()` from Supabase `life_areas`) that Duane can reword, reorder, or add to without a redeploy — any icon or letter badge derived from an area's name is a fixed mapping that will eventually collide (e.g. two areas starting with the same letter) or silently go stale. `components/audit/LeverageClient.tsx` instead uses a plain radio-style dot indicator that carries no information derived from the area's content — just the standard selected/unselected state already used elsewhere in the app.
- **The audit-step cross-fade (`lib/view-transition.ts`) was removed**: it looked calm, but wrapping `router.push` in `document.startViewTransition` introduced a real timing gap against Next.js's own async client navigation — a risk on the single most important interaction in the product. Reliability won over the polish; navigation between audit steps is a plain, instant `router.push` again. (The "Polish pass" section above still describes the feature as originally built and hasn't been rewritten out — kept for the reasoning, not as a description of what's currently live.)
- **`/audit/intro` added, per Duane's own review of this build against his The-Aligned.com version**: he was right that the Audit itself should stay a snapshot, but flagged that someone arriving cold has no context for what a 4 versus a 7 means. This screen carries his intro framing and 1–10 scoring guide, sitting between landing and the first question — shown once, only on a fresh start, and it's the point where the audit row (and anonymous session) actually gets created, not the landing click.

## What I couldn't verify

No Node.js on this machine and no working Supabase MCP access to this project, so **none of this has been run** — not `npm install`, not the dev server, not the migration, not a real browser pass through the acceptance tests. Everything above is written carefully against the Next.js 15 / Supabase SSR / Tailwind v4 APIs as I understand them, but it needs an actual run-through before you trust it. Once Node's installed and the migration's applied, I can pick this back up and verify against the acceptance tests myself.

## Things in the brief worth a second look

- Acceptance test 8 says every `audit_responses` row should have "a score, an importance and a `priority_score`" — implemented, but see the formula note above.
- The brief's route list doesn't include a sign-in screen, but test 5 requires one — see `/login` above.
