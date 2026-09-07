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

export type CtaDestinationState = "confirmed" | "needs_confirmation" | "missing" | "no_cta" | "not_required";

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
  // A real destination was supplied — nothing to ask about, whatever kind of
  // CTA it is.
  if (destination && !isCtaNeedsConfirmation(destination)) return "confirmed";
  // Duane: a CTA that asks for a comment, a reflection or a conversation has
  // nowhere to send anyone. "Needs confirmation" against one of those is the
  // generator's default, not a real gap, and must not become client work.
  if (ctaNeedsDestination(idea.cta) === false) return "not_required";
  if (!destination) return "missing";
  return "needs_confirmation";
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
  { value: "client_summary", label: "Client summary", multiline: true },
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

// ---------------------------------------------------------------------------
// Blocked Platform Outputs (Duane, after the first full two-stage run).
//
// A Master Content item flagged PERSONAL_INPUT_REQUIRED still gets its
// intended Platform Output records — the month's plan and cadence maths
// should reflect what is intended, not only what happens to be writable
// today — but those outputs are not production-ready and must not generate
// filming, sourcing or asset requirements.
//
// Blocked is DERIVED from the master rather than stored on the output. That
// is deliberate: the moment the client supplies the missing story and
// source_evidence is edited, every output under it unblocks and its
// production requirement appears on the next recompute. A stored flag would
// have to be cleared by hand on each output, and would drift.
// ---------------------------------------------------------------------------

/** Why this Master Content item's outputs can't be produced yet, or null. */
export function masterBlockReason(idea: { source_evidence: string }): string | null {
  return needsPersonalInput(idea.source_evidence) ? "Personal input required" : null;
}

export function isMasterBlocked(idea: { source_evidence: string }): boolean {
  return masterBlockReason(idea) !== null;
}

// ---------------------------------------------------------------------------
// Does this CTA actually need a destination? (Duane, after the first full
// run: "Confirm CTA destinations for 17 Master Content items" when most of
// the CTAs were "ask people to comment / reflect / share an experience".)
//
// A CTA that asks for a reply, a reflection or a conversation has nowhere to
// send anyone — asking the client to supply a URL for it is invented work.
// A CTA that asks someone to book, download, register or view something does
// need one.
//
// Destination is tested FIRST so a mixed CTA ("comment below, then download
// the guide") is treated as needing one. A CTA matching neither stays
// unclassified and still raises the requirement — an unrecognised CTA is a
// question for a person, not something to quietly drop.
// ---------------------------------------------------------------------------

const CTA_DESTINATION_PATTERNS: RegExp[] = [
  /\bbook(ing)?\b/, /\bschedule a\b/, /\bcall\b/, /\bdemo\b/, /\btrial\b/,
  /\brequest (a|an|the)\b/, /\bappl(y|ication)\b/, /\benquir|inquir/,
  /\bsign[\s-]?up\b/, /\bregister\b/, /\bsubscribe\b/, /\bjoin (the|our|my)\b/, /\bwaitlist\b/,
  /\bdownload\b/, /\bget (the|our|my|your)\b/, /\bclaim\b/, /\bbuy\b/, /\bpurchase\b/, /\border\b/, /\benrol/,
  /\bvisit\b/, /\blink\b/, /\bbio\b/, /\bwebsite\b/, /\bform\b/, /\bcontact\b/,
  /\bsee how\b/, /\blearn more\b/, /\bfind out more\b/, /\bread (the|more)\b/,
  /\bwatch the\b/, /\blisten to the\b/,
  /\bguide\b/, /\bchecklist\b/, /\btemplate\b/, /\bwebinar\b/, /\bnewsletter\b/,
];

const CTA_ENGAGEMENT_PATTERNS: RegExp[] = [
  /\bask\b/, /\banswer\b/, /\bcomment\b/, /\brepl(y|ies)\b/, /\bdiscuss\b/, /\bconversation\b/,
  /\breflect\b/, /\bconsider\b/, /\bthink about\b/, /\bnotice\b/,
  /\bshare (your|their|an|a )/, /\btell (me|us|them)\b/, /\blet me know\b/,
  /\bwhat'?s your\b/, /\bname a\b/, /\bdescribe\b/, /\bcheck whether\b/,
  /\btag\b/, /\bsave (this|the post)\b/, /\bdm\b/, /\bmessage me\b/, /\bthoughts\b/,
  /\binvite (people|viewers|listeners|readers|founders|leaders|senior people|them)[^.]*\bto (name|describe|answer|share|reflect)/,
];

export function ctaNeedsDestination(cta: string): boolean | null {
  const text = cta.toLowerCase();
  if (!text.trim()) return null;
  if (CTA_DESTINATION_PATTERNS.some((re) => re.test(text))) return true;
  if (CTA_ENGAGEMENT_PATTERNS.some((re) => re.test(text))) return false;
  return null; // unrecognised — a person should look
}

// ---------------------------------------------------------------------------
// What kind of production work a format implies. One definition, used both by
// the requirement rows and by the Production Summary above them — Duane's
// standing condition wherever PBOS shows the same thing twice: the summary
// and the detail must never be able to disagree.
// ---------------------------------------------------------------------------

export type ProductionGroup = "filming" | "long_form" | "assets" | "writing";

const FORMAT_GROUP: Record<string, ProductionGroup | null> = {
  video: "filming",
  reel: "filming",
  short: "filming",
  live: "filming",
  clip: "filming",
  episode: "long_form",
  trailer: "long_form",
  carousel: "assets",
  static: "assets",
  image: "assets",
  text_image: "assets",
  article: "writing",
  issue: "writing",
  thread: "writing",
  // Writing a text post is the work of writing it — there is nothing to
  // film, source or upload, so it raises no production requirement.
  text: null,
};

/** The production group for a format, or null when it needs no production
 * work at all. Unknown / legacy freeform formats fall back to a guess from
 * the words in them rather than disappearing. */
export function productionGroupFor(format: string): ProductionGroup | null {
  const key = format.trim().toLowerCase();
  if (!key) return null;
  if (key in FORMAT_GROUP) return FORMAT_GROUP[key] ?? null;
  if (/podcast|episode|long[\s-]*form|webinar/.test(key)) return "long_form";
  if (/film|record|shoot|reel|video|short|clip|live/.test(key)) return "filming";
  if (/image|photo|graphic|carousel|design|thumbnail|banner|infograph|static/.test(key)) return "assets";
  if (/article|blog|newsletter|issue|thread|essay/.test(key)) return "writing";
  return "assets";
}

const FORMAT_PLURAL: Record<string, string> = {
  video: "video pieces",
  reel: "Reels",
  short: "Shorts",
  live: "live streams",
  clip: "clips",
  episode: "episodes",
  trailer: "trailers",
  carousel: "carousels",
  static: "static posts",
  image: "images",
  text_image: "text/image assets",
  article: "articles",
  issue: "issues",
  thread: "threads",
};

const FORMAT_SINGULAR: Record<string, string> = {
  video: "video piece",
  reel: "Reel",
  short: "Short",
  live: "live stream",
  clip: "clip",
  episode: "episode",
  trailer: "trailer",
  carousel: "carousel",
  static: "static post",
  image: "image",
  text_image: "text/image asset",
  article: "article",
  issue: "issue",
  thread: "thread",
};

/** "Shorts" / "Short" — how a format reads in a summary line. */
export function formatNoun(format: string, count: number): string {
  const key = format.trim().toLowerCase();
  const table = count === 1 ? FORMAT_SINGULAR : FORMAT_PLURAL;
  return table[key] ?? (count === 1 ? key : `${key}s`);
}
