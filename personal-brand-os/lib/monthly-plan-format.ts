/**
 * Plain formatting helpers for Monthly Plans, kept out of
 * lib/actions/monthly-plans.ts deliberately: that file is "use server", which
 * makes every export a server action callable only via the RPC boundary
 * (async, serialisable args) — these are synchronous formatters used from
 * both server and client components.
 */

/** "October 2026" from a Monthly Plan's period_month date. */
export function periodMonthLabel(periodMonth: string): string {
  return new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "MC-01" style display numbering for a plan_sequence value. */
export function planSequenceLabel(n: number | null): string {
  return n === null ? "" : `MC-${String(n).padStart(2, "0")}`;
}

/** An account this client's own strategy has ruled out — never offered to
 * the AI as a destination, and a hard validation error on import if one
 * shows up there anyway. Shared between the export/import logic and the
 * pages that render a lead-platform picker, so both agree on what "excluded"
 * means. */
export function isPlatformExcluded(account: { account_status: string; publishing_enabled: boolean; cross_post_rule: string }): boolean {
  return account.account_status === "inactive" || !account.publishing_enabled || account.cross_post_rule === "never";
}

export function platformLabel(account: { platform: string; account_name: string }): string {
  return account.account_name ? `${account.platform} — ${account.account_name}` : account.platform;
}

// ---------------------------------------------------------------------------
// CTA destination state (Duane, after the first full run): the AI writes the
// literal "Needs confirmation" rather than inventing a URL, and that is a
// real state PBOS must keep — "not yet confirmed" is not the same thing as
// "nobody set one". Stored as the literal in cta_destination so it stays
// visible wherever the field is shown; read back through this helper.
// ---------------------------------------------------------------------------

export const CTA_NEEDS_CONFIRMATION = "Needs confirmation";

export type CtaDestinationState = "confirmed" | "needs_confirmation" | "missing" | "no_cta";

export function isCtaNeedsConfirmation(value: string): boolean {
  return value.trim().toLowerCase() === CTA_NEEDS_CONFIRMATION.toLowerCase();
}

/** Canonical spelling of the sentinel; anything else passes through. */
export function normaliseCtaDestination(value: string): string {
  return isCtaNeedsConfirmation(value) ? CTA_NEEDS_CONFIRMATION : value.trim();
}

export function ctaDestinationState(idea: { cta: string; cta_destination: string }): CtaDestinationState {
  if (!idea.cta.trim()) return "no_cta";
  const destination = idea.cta_destination.trim();
  if (!destination) return "missing";
  if (isCtaNeedsConfirmation(destination)) return "needs_confirmation";
  return "confirmed";
}

// ---------------------------------------------------------------------------
// Approval lock (Duane's three edit levels). Once a plan is approved its
// Master Content is the approved version of that month: direct edits and
// single-item regenerations become change requests on that item, and a whole
// -month regeneration becomes a numbered revision — never a silent overwrite.
// ---------------------------------------------------------------------------

export const LOCKED_PLAN_STATUSES = ["approved", "active", "closed"] as const;

export function isPlanLocked(status: string): boolean {
  return (LOCKED_PLAN_STATUSES as readonly string[]).includes(status);
}

/** Master Content fields a change request may target. */
export const CHANGE_REQUEST_FIELDS: { value: string; label: string; multiline: boolean }[] = [
  { value: "title", label: "Title", multiline: false },
  { value: "hook", label: "Hook", multiline: false },
  { value: "core_message", label: "Core message", multiline: true },
  { value: "purpose", label: "Purpose", multiline: true },
  { value: "cta", label: "CTA", multiline: false },
  { value: "cta_destination", label: "CTA destination", multiline: false },
  { value: "lead_draft_copy", label: "Lead draft copy", multiline: true },
  { value: "body", label: "Brief / body", multiline: true },
  { value: "notes", label: "Notes", multiline: true },
  { value: "why_now", label: "Why now", multiline: true },
  { value: "source_evidence", label: "Source evidence", multiline: true },
  { value: "client_requirements", label: "Client requirements", multiline: true },
];

/** "MC-03 · Title" — how a change request names its Master Content item.
 * Lives here (not in the client panel) so the server-rendered plan page can
 * call it: a function exported from a "use client" module can only be
 * rendered as a component or passed as a prop, never invoked on the server. */
export function changeRequestIdeaLabel(seq: number | null, title: string): string {
  return `${planSequenceLabel(seq)} · ${title}`;
}

// ---------------------------------------------------------------------------
// Platform families & approved formats (Duane's second real run): every
// active account the brief offers must come with an exact allowed-format
// list — a platform the map doesn't know gets a generic list rather than
// nothing, because "nothing" is what made the model invent formats.
// Families are matched on words in the platform name, so a custom platform
// such as "Podcast / YouTube / Long-form Video" is recognised as both.
// ---------------------------------------------------------------------------

export const PLATFORM_FORMATS: Record<string, string[]> = {
  linkedin: ["text", "text_image", "carousel", "video"],
  instagram: ["reel", "carousel", "static"],
  youtube: ["video", "short", "live"],
  podcast: ["episode", "clip", "trailer"],
  tiktok: ["video"],
  facebook: ["text", "text_image", "carousel", "video", "reel"],
  x: ["text", "text_image", "video", "thread"],
  threads: ["text", "text_image"],
  newsletter: ["issue"],
  blog: ["article"],
};

/** Used when no family matches — always a real, validated list. */
export const DEFAULT_FORMATS = ["text", "image", "video"];

const FAMILY_MATCHERS: [string, RegExp][] = [
  ["linkedin", /linkedin/],
  ["instagram", /instagram|\big\b|insta/],
  ["youtube", /youtube|\byt\b/],
  ["podcast", /podcast|long[\s-]*form/],
  ["tiktok", /tiktok/],
  ["facebook", /facebook|\bfb\b/],
  ["x", /\bx\b|twitter/],
  ["threads", /threads/],
  ["newsletter", /newsletter|email/],
  ["blog", /blog|article|website/],
];

/** Every family a platform name belongs to, in map order; empty for an
 * unrecognised platform. */
export function platformFamilies(platform: string): string[] {
  const key = platform.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return FAMILY_MATCHERS.filter(([, re]) => re.test(key)).map(([family]) => family);
}

/** The one key sibling grouping uses: the first matched family, or the
 * normalised platform name itself when nothing matches. */
export function platformFamilyKey(platform: string): string {
  return platformFamilies(platform)[0] ?? platform.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** The approved formats for a platform — union across matched families,
 * DEFAULT_FORMATS when none match. Never empty, never null. */
export function allowedFormatsFor(platform: string): string[] {
  const families = platformFamilies(platform);
  if (families.length === 0) return [...DEFAULT_FORMATS];
  const out: string[] = [];
  for (const family of families) for (const f of PLATFORM_FORMATS[family] ?? []) if (!out.includes(f)) out.push(f);
  return out.length > 0 ? out : [...DEFAULT_FORMATS];
}

// ---------------------------------------------------------------------------
// Client Source Library (Duane): the consultation is where the person
// lives. Extracted items are typed so generation can be told what each is.
// ---------------------------------------------------------------------------

export const SOURCE_ITEM_KINDS: { value: string; label: string; plural: string; hint: string }[] = [
  { value: "story", label: "Story", plural: "Stories", hint: "A real experience the client is comfortable using publicly" },
  { value: "belief", label: "Belief", plural: "Beliefs", hint: "A clearly stated view or principle" },
  { value: "voice", label: "Voice", plural: "Voice — phrases they actually use", hint: "An exact phrase or way of putting things" },
  { value: "avoid", label: "Avoid", plural: "Phrases / styles to avoid", hint: "Language or a style the client does not want" },
  { value: "rejected_view", label: "Rejects", plural: "Views they explicitly reject", hint: "Something the client has said they do not believe" },
  { value: "priority", label: "Priority", plural: "Current priorities", hint: "What matters to them right now" },
  { value: "opportunity", label: "Opportunity", plural: "Content opportunities", hint: "A theme or angle worth making content about" },
  { value: "update", label: "Update", plural: "Recent updates", hint: "A recent personal or business development" },
];

export function sourceItemKindMeta(kind: string) {
  return SOURCE_ITEM_KINDS.find((k) => k.value === kind) ?? SOURCE_ITEM_KINDS[0]!;
}

/** The AI's answer when an idea would benefit from personal evidence that
 * the profile, source library and monthly update don't contain. Never
 * fabricate — flag. */
export const PERSONAL_INPUT_REQUIRED = "PERSONAL_INPUT_REQUIRED";

export function needsPersonalInput(value: string): boolean {
  return value.toUpperCase().includes(PERSONAL_INPUT_REQUIRED);
}
