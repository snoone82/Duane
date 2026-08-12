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

**Two things worth knowing before trusting a run:**
- If the Supabase project has **Authentication → Providers → Email → "Confirm
  email"** turned on, `database.spec.ts`'s re-sign-in step may fail until the
  confirmation link is clicked — see the "Decisions I made" section below.
  Turn it off for whichever project you point the suite at.
- None of this has actually been run (no Node.js in the environment these
  tests were written in — see "What I couldn't verify"). The specs are
  written carefully against the real acceptance criteria and the app's
  actual DOM/roles/labels, but they need a real run to confirm they pass as
  written.

## What's built

- `/` — landing, one button, resumes an in-progress audit if one exists for the current session.
- `/audit` — one life area per screen, fetched from `life_areas` (never hardcoded), satisfaction (1–10, number grid) and importance (1–5, pill row — deliberately different shape) as two distinct questions, optional note, autosave on every rating change (debounced on the note field), progress bar, working back navigation.
- `/audit/leverage` — the ten areas as single-select options, saved on tap.
- `/audit/complete` — completes the audit (sum of the ten satisfaction scores → `total_score`), reveals the score, then account creation that converts the anonymous user in place via `supabase.auth.updateUser` (never a second user).
- `/dashboard` — score, radar chart (custom SVG, no charting library), area breakdown sorted by `sort_order`, "what happens next" copy. No priority scores, no recommended focus area shown.
- `/login` — not in the brief's route list, added because acceptance test 5 ("sign out, sign back in") needs somewhere to do that. Minimal email/password form.
- Sign-out button on the dashboard.
- Every table write goes through Server Actions (`app/actions/`) using the `@supabase/ssr` server client, scoped entirely by RLS — no service-role key anywhere.
- Password fields (account creation, `/login`) have a show/hide toggle, and navigation between audit steps has a soft cross-fade — see "Polish pass" below.

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

Coach dashboard, CLEAR, goals, tracker, comparison views — not built, not stubbed, no placeholder routes for them. `audit_reviews`, `goals`, `goal_actions`, `checkins`, `session_notes` are untouched.

## Decisions I made that weren't specified

- **`priority_score` formula**: `importance_score * (10 - satisfaction_score)`, computed as a stored generated column (range 0–45). The brief requires the column to exist and be visible in the table editor but doesn't define the formula — this weights low-satisfaction/high-importance areas highest, which seemed like the useful triage signal for the coach. It's derived in the database and never surfaced in the app UI. Worth confirming this formula is what you actually want.
- **`profiles.is_anonymous`**: added this column (kept in sync by trigger) so the app can tell "audit completed but still anonymous" apart from "has a real account" — used to decide whether `/audit/complete` should redirect straight to `/dashboard`. Not in the brief's table list but seemed necessary to make the flow work.
- **`/login` route**: added, see above — required by acceptance test 5, not in the brief's route diagram.
- **Ten life areas seeded**: the brief says areas are content-managed and never hardcoded, but a fresh table needs *something* in it. Originally seeded with ten placeholder names, since replaced (via [`0002_update_life_areas_content.sql`](supabase/migrations/0002_update_life_areas_content.sql)) with Duane's confirmed final list: Health & Energy, Mindset & Thinking, Confidence & Self-Belief, Relationships & Connection, Career, Work & Business, Money & Stability, Purpose & Direction, Daily Structure & Discipline, Emotional Wellbeing, Self-Respect & Identity. Reword further any time from the Supabase dashboard — the app never needs a redeploy for that.
- **Existing-email signup handling**: per the brief, I did not build anonymous-to-existing-account linking (it's genuinely non-trivial — it means transferring an audit's `user_id` across accounts, which the immutability model doesn't have an obvious safe path for). When `updateUser` fails because the email's taken, the app shows a clear message and a link to `/login`, and stops there. Flagging this exactly as the brief asked, rather than inventing something.
- **Email confirmation**: if your Supabase project has "Confirm email" turned on, the new email/password is set but `is_anonymous` won't flip to `false` (and future sign-in requires their password to work either way) until they click the confirmation link. The user *does* still land straight on `/dashboard` with their results, so acceptance test 4 holds — but it's worth deciding deliberately whether that setting should be on or off for this flow.
- **`ScoreRing` is a static, non-achievement dial, not a "fill" progress ring**: a ring that fills proportionally to the score (or colour-codes by tier) reads as "you're X% of the way to a good outcome" — an achievement/progress metaphor that conflicts with the product rule that a score must never read as a verdict or grade on the person. So `components/ui/ScoreRing.tsx` draws a single complete circle whose stroke weight and colour never depend on `value` at all — it's a quiet, constant frame around the number, identical whether the score is 12 or 98. `value`/`max` only drive the centered number and the accessible label.
- **No per-area icons/initials on the leverage list**: the ten life areas are pure database content (`getLifeAreas()` from Supabase `life_areas`) that Duane can reword, reorder, or add to without a redeploy — any icon or letter badge derived from an area's name is a fixed mapping that will eventually collide (e.g. two areas starting with the same letter) or silently go stale. `components/audit/LeverageClient.tsx` instead uses a plain radio-style dot indicator that carries no information derived from the area's content — just the standard selected/unselected state already used elsewhere in the app.

## What I couldn't verify

No Node.js on this machine and no working Supabase MCP access to this project, so **none of this has been run** — not `npm install`, not the dev server, not the migration, not a real browser pass through the acceptance tests. Everything above is written carefully against the Next.js 15 / Supabase SSR / Tailwind v4 APIs as I understand them, but it needs an actual run-through before you trust it. Once Node's installed and the migration's applied, I can pick this back up and verify against the acceptance tests myself.

## Things in the brief worth a second look

- Acceptance test 8 says every `audit_responses` row should have "a score, an importance and a `priority_score`" — implemented, but see the formula note above.
- The brief's route list doesn't include a sign-in screen, but test 5 requires one — see `/login` above.
