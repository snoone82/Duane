/**
 * Client Profile Import (Duane batch 3, §1).
 *
 * A fixed JSON format that an external AI fills in from a consultation
 * transcript, and this module interprets: parse → validate → normalized
 * payload + review information. Nothing here touches the database — the
 * server actions in lib/actions/import.ts do preview/commit on top.
 *
 * Two sentinel values keep the AI honest (it must never guess):
 *   "NEEDS_CLIENT_CONFIRMATION" — unknown; store blank, flag for follow-up
 *   "NOT_APPLICABLE"            — genuinely n/a; store blank, no flag
 */

import { isSectionMode, type SectionMode } from "@/lib/import/record-match";
import { matchRole, matchCrossPost, parseCadence, parsePostingDays } from "@/lib/import/platform-strategy";

export const NEEDS_CONFIRMATION = "NEEDS_CLIENT_CONFIRMATION";
export const NOT_APPLICABLE = "NOT_APPLICABLE";

export interface ImportIssues {
  /** Field labels the AI marked as needing the client's confirmation. */
  needsConfirmation: string[];
  /** Non-fatal problems: dropped bad dates, unknown values coerced, etc. */
  warnings: string[];
  /** Every field label that arrived with a real value this time. Update
   * imports use this to auto-tick matching items on the outstanding
   * "Confirm outstanding profile details" checklist (Duane Part H §14). */
  resolvedLabels: string[];
}

/** Repeatable sections an update import can address as a whole. */
export type RepeatableSection = "audiences" | "social_strategies" | "content_pillars" | "authority_opportunities";

export const REPEATABLE_SECTIONS: RepeatableSection[] = [
  "audiences",
  "social_strategies",
  "content_pillars",
  "authority_opportunities",
];

export interface ParsedClientImport extends ImportIssues {
  /** Per-section import behaviour, defaulting to UPSERT (Duane's ask: an
   * update should behave like a database update, not another layer of
   * appends). Only present for sections the file actually included. */
  sectionModes: Partial<Record<RepeatableSection, SectionMode>>;
  overview: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    job_title: string | null;
    industry: string | null;
    location: string | null;
    package: string | null;
    retainer_amount: number | null;
    north_star: string;
    notes: string | null;
    website_url: string | null;
  };
  vision: Record<string, string>;
  positioning: Record<string, string>;
  sales: Record<string, string>;
  /** The permanent content direction every Monthly Plan inherits (migration 0034). */
  contentGuidelines: Record<string, string>;
  audiences: { id: string | null; name: string; fields: Record<string, string> }[];
  /** `fields` holds every column as text (numbers and day lists stringified
   * so the diff against the current row is one comparison); the importer
   * converts cadence_target / posting_days back to their real types on
   * write. Audience links arrive as names and are resolved by the importer. */
  socials: {
    id: string | null;
    platform: string;
    fields: Record<string, string>;
    primaryAudience: string | null;
    secondaryAudience: string | null;
  }[];
  pillars: { id: string | null; name: string; fields: Record<string, string> }[];
  contentIdeas: {
    title: string;
    pillar: string | null;
    audience: string | null;
    hook: string;
    body: string;
    notes: string;
    priority: "low" | "medium" | "high";
    platforms: string[];
  }[];
  authority: {
    id: string | null;
    type: string;
    host: string | null;
    status: string;
    opportunity_date: string | null;
    audience_size: number | null;
    contact_name: string | null;
    contact_email: string | null;
    notes: string;
  }[];
  consultations: { meeting_date: string | null; fields: Record<string, string> }[];
  /** Story / Belief / Voice bank items (Duane) — appended, deduplicated on kind + text. */
  sourceItems: { kind: string; text: string; source_quote: string; source_date: string | null; pillar: string | null; sensitivity: "public" | "sensitive" }[];
  actions: {
    /** Internal PBOS action id when the AI is updating a known action. */
    id: string | null;
    title: string;
    description: string;
    due_date: string | null;
    owner_name: string | null;
    status: "not_started" | "in_progress" | "waiting" | "completed" | null;
    priority: "low" | "medium" | "high" | null;
    visibility: "internal" | "client" | null;
    /** Subtasks — created with the action, merged by text on updates. */
    checklist: { text: string; done: boolean }[];
  }[];
  metricSnapshots: { platform: string; snapshot_date: string; followers: number; extras: Record<string, number | null> }[];
  metricTargets: { platform: string; metric: string; baseline_value: number | null; target_value: number | null; target_date: string | null }[];
  milestones: { title: string; milestone_date: string; description: string; is_highlighted: boolean }[];
}

const VISION_FIELDS = ["long_term_goal", "desired_positioning", "authority_goal", "commercial_goal", "impact_goal", "legacy_contribution"];
const POSITIONING_FIELDS = [
  "current_positioning", "desired_positioning", "positioning_statement", "expertise",
  "unique_story", "differentiators", "core_beliefs", "contrarian_opinions",
];
const SALES_FIELDS = [
  "services_products", "target_customers", "ideal_clients", "offers", "sales_messaging",
  "lead_generation_approach", "calls_to_action", "lead_magnets", "enquiry_process",
  "sales_conversations", "referral_opportunities",
];
const AUDIENCE_FIELDS = [
  "description", "demographics", "stage", "pain_points", "goals", "content_interests",
  "target_belief", "target_action", "where_they_are", "notes",
];
const SOCIAL_FIELDS = [
  "account_name", "owner_brand", "url", "objective", "audience", "content_types",
  "posting_frequency", "growth_strategy", "engagement_strategy", "cta_strategy",
];
/** Platform Strategy prose fields — Duane's JSON key → our column. Same
 * names the standalone Platform Strategy import uses. */
const SOCIAL_STRATEGY_TEXT: Record<string, string> = {
  tone_voice: "tone_voice",
  preferred_formats: "preferred_formats",
  typical_length: "content_length",
  commercial_balance: "commercial_ratio",
  how_to_open: "hook_guidance",
  dont_post_here: "platform_exclusions",
  repurposing_rules: "repurposing_rules",
  ai_generation_instructions: "ai_instructions",
};
const ACCOUNT_TYPES = ["personal", "company", "programme"];
const ACCOUNT_STATUSES = ["active", "planned", "inactive"];
const CONTENT_GUIDELINES_FIELDS = [
  "secondary_objectives", "tone_voice_notes", "preferred_language", "avoid_language",
  "cta_priorities", "primary_cta_destination", "content_safeguards",
];
const PILLAR_FIELDS = [
  "description", "target_audience", "purpose", "key_messages", "example_topics",
  "associated_stories", "relevant_expertise", "calls_to_action",
];
const CONSULTATION_FIELDS = [
  "meeting_type", "summary", "attendees", "client_updates", "wins", "challenges",
  "strategic_observations", "decisions_made", "content_discussed", "commercial_opportunities", "transcript",
];
const SOURCE_ITEM_KIND_VALUES = ["story", "belief", "voice", "avoid", "rejected_view", "priority", "opportunity", "update"];
const AUTHORITY_STATUSES = ["identified", "pitched", "in_conversation", "booked", "completed", "published", "declined"];
const SNAPSHOT_EXTRAS = ["follower_growth", "impressions", "reach", "engagement", "profile_visits", "video_views", "comments", "shares", "saves"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ways the AI may echo a record's PBOS id back to us. Read for matching,
 * never written as a column. */
const ID_KEYS = ["id", "record_id", "pbos_id"];

/** Everything the parser needs to turn one AI-provided value into a clean
 * string, flagging the two sentinels along the way. */
function text(raw: unknown, label: string, issues: ImportIssues): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (typeof raw !== "string") {
    issues.warnings.push(`${label}: expected text, got something else — left blank.`);
    return "";
  }
  const value = raw.trim();
  if (value === NEEDS_CONFIRMATION) {
    issues.needsConfirmation.push(label);
    return "";
  }
  if (value === NOT_APPLICABLE) return "";
  if (value) issues.resolvedLabels.push(label);
  return value;
}

function num(raw: unknown, label: string, issues: ImportIssues): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string") {
    if (raw.trim() === NEEDS_CONFIRMATION) {
      issues.needsConfirmation.push(label);
      return null;
    }
    if (raw.trim() === NOT_APPLICABLE) return null;
  }
  const value = Number(raw);
  if (Number.isNaN(value)) {
    issues.warnings.push(`${label}: "${String(raw)}" isn't a number — left blank.`);
    return null;
  }
  issues.resolvedLabels.push(label);
  return value;
}

function date(raw: unknown, label: string, issues: ImportIssues): string | null {
  const value = text(raw, label, issues);
  if (!value) return null;
  if (!DATE_RE.test(value)) {
    issues.warnings.push(`${label}: "${value}" isn't a YYYY-MM-DD date — left blank.`);
    return null;
  }
  return value;
}

function fieldMap(raw: unknown, allowed: string[], sectionLabel: string, issues: ImportIssues, alsoKnown: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw === null || raw === undefined) return out;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    issues.warnings.push(`${sectionLabel}: expected an object — section skipped.`);
    return out;
  }
  const record = raw as Record<string, unknown>;
  for (const key of allowed) {
    if (key in record) out[key] = text(record[key], `${sectionLabel} → ${key}`, issues);
  }
  for (const key of Object.keys(record)) {
    // Identity keys are read separately and must never reach a column patch.
    if (ID_KEYS.includes(key) || alsoKnown.includes(key)) continue;
    if (!allowed.includes(key)) issues.warnings.push(`${sectionLabel}: unrecognised field "${key}" ignored.`);
  }
  return out;
}

/**
 * A repeatable section arrives either as a plain list (the original format,
 * always UPSERT) or as {"mode": "...", "items": [...]} when the AI is told
 * the list is definitive. Both shapes are supported so older templates keep
 * working untouched.
 */
function asSection(
  raw: unknown,
  label: string,
  issues: ImportIssues
): { items: unknown[]; mode: SectionMode | null; present: boolean } {
  if (raw === null || raw === undefined) return { items: [], mode: null, present: false };
  if (Array.isArray(raw)) return { items: raw, mode: null, present: true };
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const modeRaw = typeof record.mode === "string" ? record.mode.trim().toLowerCase() : null;
    let mode: SectionMode | null = null;
    if (modeRaw) {
      if (isSectionMode(modeRaw)) mode = modeRaw;
      else issues.warnings.push(`${label}: unknown mode "${modeRaw}" — treated as an update (upsert).`);
    }
    if (!Array.isArray(record.items)) {
      issues.warnings.push(`${label}: expected an "items" list alongside "mode" — section skipped.`);
      return { items: [], mode, present: true };
    }
    return { items: record.items, mode, present: true };
  }
  issues.warnings.push(`${label}: expected a list — section skipped.`);
  return { items: [], mode: null, present: false };
}

function asArray(raw: unknown, label: string, issues: ImportIssues): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.warnings.push(`${label}: expected a list — section skipped.`);
    return [];
  }
  return raw;
}

/** Strip markdown code fences an AI often wraps JSON in. */
function stripFences(input: string): string {
  return input
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export type ParseResult = { ok: true; parsed: ParsedClientImport } | { ok: false; error: string };

export function parseClientImport(input: string, options?: { requireName?: boolean }): ParseResult {
  const requireName = options?.requireName ?? true;
  let root: unknown;
  try {
    root = JSON.parse(stripFences(input));
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste exactly what the AI produced — including the curly braces — with nothing added around it." };
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { ok: false, error: "The import must be a JSON object." };
  }
  const doc = root as Record<string, unknown>;
  if (doc.pbos_import !== "client_profile") {
    return { ok: false, error: "This isn't a PBOS client profile import — the pbos_import marker is missing or wrong. Use the template provided." };
  }
  if (doc.version !== 1) {
    return { ok: false, error: `Unsupported import version "${String(doc.version)}" — this build understands version 1.` };
  }

  const issues: ImportIssues = { needsConfirmation: [], warnings: [], resolvedLabels: [] };

  const overviewRaw = (typeof doc.overview === "object" && doc.overview !== null ? doc.overview : {}) as Record<string, unknown>;
  const name = text(overviewRaw.name, "Overview → name", issues);
  if (!name && requireName) {
    return { ok: false, error: "The client's name (overview.name) is required — an import can't create a nameless client." };
  }

  const nullable = (v: string) => v || null;
  const overview: ParsedClientImport["overview"] = {
    name,
    email: nullable(text(overviewRaw.email, "Overview → email", issues)),
    phone: nullable(text(overviewRaw.phone, "Overview → phone", issues)),
    company: nullable(text(overviewRaw.company, "Overview → company", issues)),
    job_title: nullable(text(overviewRaw.job_title, "Overview → job title", issues)),
    industry: nullable(text(overviewRaw.industry, "Overview → industry", issues)),
    location: nullable(text(overviewRaw.location, "Overview → location", issues)),
    package: nullable(text(overviewRaw.package, "Overview → package", issues)),
    retainer_amount: num(overviewRaw.retainer_amount, "Overview → retainer amount", issues),
    north_star: text(overviewRaw.north_star, "Overview → North Star", issues),
    notes: nullable(text(overviewRaw.notes, "Overview → notes", issues)),
    website_url: nullable(text(overviewRaw.website_url, "Overview → website", issues)),
  };

  const sectionModes: Partial<Record<RepeatableSection, SectionMode>> = {};

  /** The record's PBOS id, when the AI was given one to echo back. Never
   * invented — a blank id just means "match me by name instead". */
  const recordId = (record: Record<string, unknown>): string | null => {
    const raw = record.id ?? record.record_id ?? record.pbos_id;
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    if (!value || value === NEEDS_CONFIRMATION || value === NOT_APPLICABLE) return null;
    return value;
  };

  const audienceSection = asSection(doc.audiences, "Audiences", issues);
  if (audienceSection.mode) sectionModes.audiences = audienceSection.mode;
  const audiences = audienceSection.items.flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const audienceName = text(record.name, `Audience ${i + 1} → name`, issues);
    if (!audienceName) {
      issues.warnings.push(`Audience ${i + 1} has no name — skipped.`);
      return [];
    }
    return [
      {
        id: recordId(record),
        name: audienceName,
        fields: fieldMap(record, ["name", ...AUDIENCE_FIELDS], `Audience "${audienceName}"`, issues),
      },
    ];
  });

  const socialSection = asSection(doc.social_strategies, "Social strategies", issues);
  if (socialSection.mode) sectionModes.social_strategies = socialSection.mode;
  const socials = socialSection.items.flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const platform = text(record.platform, `Social strategy ${i + 1} → platform`, issues);
    if (!platform) {
      issues.warnings.push(`Social strategy ${i + 1} has no platform — skipped.`);
      return [];
    }
    const accountNameRaw = typeof record.account_name === "string" ? record.account_name.trim() : "";
    const label = `Social "${platform}${accountNameRaw ? ` — ${accountNameRaw}` : ""}"`;
    // Strategy keys are read by hand below — tell fieldMap they're known so
    // they aren't reported as unrecognised.
    const fields = fieldMap(record, ["platform", ...SOCIAL_FIELDS], label, issues, [
      ...Object.keys(SOCIAL_STRATEGY_TEXT),
      "account_type", "account_status", "role_in_strategy", "cross_posting_rule",
      "target_cadence", "posting_days", "primary_audience", "secondary_audience",
    ]);

    // --- Platform Strategy (Duane: expose the newer fields here too) ---
    for (const [jsonKey, column] of Object.entries(SOCIAL_STRATEGY_TEXT)) {
      const value = text(record[jsonKey], `${label} → ${jsonKey.replace(/_/g, " ")}`, issues);
      if (value) fields[column] = value;
    }
    const accountType = text(record.account_type, `${label} → account type`, issues).toLowerCase();
    if (accountType) {
      if (ACCOUNT_TYPES.includes(accountType)) fields.account_type = accountType;
      else issues.warnings.push(`${label}: account_type "${accountType}" isn't one of ${ACCOUNT_TYPES.join(" | ")} — left unchanged.`);
    }
    const accountStatus = text(record.account_status, `${label} → account status`, issues).toLowerCase();
    if (accountStatus) {
      if (ACCOUNT_STATUSES.includes(accountStatus)) fields.account_status = accountStatus;
      else issues.warnings.push(`${label}: account_status "${accountStatus}" isn't one of ${ACCOUNT_STATUSES.join(" | ")} — left unchanged.`);
    }
    const roleRaw = text(record.role_in_strategy, `${label} → role`, issues);
    if (roleRaw) {
      const role = matchRole(roleRaw);
      if (role.value) fields.platform_role = role.value;
      if (role.warning) issues.warnings.push(`${label}: ${role.warning}`);
    }
    const ruleRaw = text(record.cross_posting_rule, `${label} → cross-posting rule`, issues);
    if (ruleRaw) {
      const rule = matchCrossPost(ruleRaw);
      if (rule.value) fields.cross_post_rule = rule.value;
      if (rule.warning) issues.warnings.push(`${label}: ${rule.warning}`);
    }
    const cadence = parseCadence(record.target_cadence);
    if (cadence.value) {
      fields.cadence_target = String(cadence.value.target);
      fields.cadence_period = cadence.value.period;
      issues.resolvedLabels.push(`${label} → target cadence`);
    }
    if (cadence.warning) issues.warnings.push(`${label}: ${cadence.warning}`);
    const postingDays = parsePostingDays(record.posting_days);
    if (postingDays.value) {
      fields.posting_days = postingDays.value.join(",");
      issues.resolvedLabels.push(`${label} → posting days`);
    }
    if (postingDays.warning) issues.warnings.push(`${label}: ${postingDays.warning}`);

    return [
      {
        id: recordId(record),
        platform,
        fields,
        primaryAudience: text(record.primary_audience, `${label} → primary audience`, issues) || null,
        secondaryAudience: text(record.secondary_audience, `${label} → secondary audience`, issues) || null,
      },
    ];
  });

  const pillarSection = asSection(doc.content_pillars, "Content pillars", issues);
  if (pillarSection.mode) sectionModes.content_pillars = pillarSection.mode;
  const pillars = pillarSection.items.flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const pillarName = text(record.name, `Pillar ${i + 1} → name`, issues);
    if (!pillarName) {
      issues.warnings.push(`Content pillar ${i + 1} has no name — skipped.`);
      return [];
    }
    return [
      {
        id: recordId(record),
        name: pillarName,
        fields: fieldMap(record, ["name", ...PILLAR_FIELDS], `Pillar "${pillarName}"`, issues),
      },
    ];
  });

  const contentIdeas = asArray(doc.content_ideas, "Content ideas", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const title = text(record.title, `Content idea ${i + 1} → title`, issues);
    if (!title) {
      issues.warnings.push(`Content idea ${i + 1} has no title — skipped.`);
      return [];
    }
    const priorityRaw = text(record.priority, `Content idea "${title}" → priority`, issues).toLowerCase();
    const priority: "low" | "medium" | "high" = priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";
    const platforms = asArray(record.platforms, `Content idea "${title}" → platforms`, issues)
      .map((p) => text(p, `Content idea "${title}" → platform`, issues))
      .filter(Boolean);
    return [
      {
        title,
        pillar: text(record.pillar, `Content idea "${title}" → pillar`, issues) || null,
        audience: text(record.audience, `Content idea "${title}" → audience`, issues) || null,
        hook: text(record.hook, `Content idea "${title}" → hook`, issues),
        body: text(record.brief ?? record.body, `Content idea "${title}" → brief`, issues),
        notes: text(record.notes, `Content idea "${title}" → notes`, issues),
        priority,
        platforms,
      },
    ];
  });

  const authoritySection = asSection(doc.authority_opportunities, "Authority & opportunities", issues);
  if (authoritySection.mode) sectionModes.authority_opportunities = authoritySection.mode;
  const authority = authoritySection.items.flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const type = text(record.type, `Opportunity ${i + 1} → type`, issues);
    if (!type) {
      issues.warnings.push(`Authority opportunity ${i + 1} has no type — skipped.`);
      return [];
    }
    let status = text(record.status, `Opportunity "${type}" → status`, issues).toLowerCase().replace(/ /g, "_");
    if (!AUTHORITY_STATUSES.includes(status)) {
      if (status) issues.warnings.push(`Opportunity "${type}": unknown status "${status}" — set to "identified".`);
      status = "identified";
    }
    return [
      {
        id: recordId(record),
        type,
        host: text(record.host, `Opportunity "${type}" → host`, issues) || null,
        status,
        opportunity_date: date(record.opportunity_date, `Opportunity "${type}" → date`, issues),
        audience_size: num(record.audience_size, `Opportunity "${type}" → audience size`, issues),
        contact_name: text(record.contact_name, `Opportunity "${type}" → contact name`, issues) || null,
        contact_email: text(record.contact_email, `Opportunity "${type}" → contact email`, issues) || null,
        notes: text(record.notes, `Opportunity "${type}" → notes`, issues),
      },
    ];
  });

  const consultations = asArray(doc.consultations, "Meetings & consultations", issues).map((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    return {
      meeting_date: date(record.meeting_date, `Meeting ${i + 1} → date`, issues),
      fields: fieldMap(record, ["meeting_date", "next_meeting_date", ...CONSULTATION_FIELDS], `Meeting ${i + 1}`, issues),
    };
  });

  const sourceItems = asArray(doc.source_library, "Source library", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const kind = text(record.kind, `Source item ${i + 1} → kind`, issues).toLowerCase().replace(/[\s-]+/g, "_");
    const itemText = text(record.text, `Source item ${i + 1} → text`, issues);
    if (!itemText) {
      issues.warnings.push(`Source item ${i + 1} has no text — skipped.`);
      return [];
    }
    if (!SOURCE_ITEM_KIND_VALUES.includes(kind)) {
      issues.warnings.push(`Source item "${itemText.slice(0, 40)}": kind "${kind || "(blank)"}" isn't one of ${SOURCE_ITEM_KIND_VALUES.join(" | ")} — skipped.`);
      return [];
    }
    const sensitivityRaw = text(record.sensitivity, `Source item ${i + 1} → sensitivity`, issues).toLowerCase();
    return [
      {
        kind,
        text: itemText,
        source_quote: text(record.source_quote, `Source item ${i + 1} → quote`, issues),
        source_date: date(record.source_date, `Source item ${i + 1} → date`, issues),
        pillar: text(record.pillar, `Source item ${i + 1} → pillar`, issues) || null,
        sensitivity: sensitivityRaw === "sensitive" ? ("sensitive" as const) : ("public" as const),
      },
    ];
  });

  const actions = asArray(doc.actions, "Actions", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const id = text(record.action_id ?? record.id, `Action ${i + 1} → action id`, issues) || null;
    // A title is required to CREATE an action; an update can arrive as just
    // {action_id, status} — the existing record supplies the title.
    const title = text(record.title, `Action ${i + 1} → title`, issues) || (id ? `(action ${id.slice(0, 8)})` : "");
    if (!title) {
      issues.warnings.push(`Action ${i + 1} has no title or action_id — skipped.`);
      return [];
    }
    // Status arrives in Duane's display form ("In Progress") or as the enum.
    const statusRaw = text(record.status, `Action "${title}" → status`, issues).toLowerCase().replace(/[ -]/g, "_");
    const STATUS_ALIASES: Record<string, "not_started" | "in_progress" | "waiting" | "completed"> = {
      not_started: "not_started",
      in_progress: "in_progress",
      waiting: "waiting",
      completed: "completed",
      complete: "completed",
      done: "completed",
    };
    const status = STATUS_ALIASES[statusRaw] ?? null;
    if (statusRaw && !status) issues.warnings.push(`Action "${title}": unknown status "${statusRaw}" — left unchanged.`);
    const priorityRaw = text(record.priority, `Action "${title}" → priority`, issues).toLowerCase();
    const priority: "low" | "medium" | "high" | null =
      priorityRaw === "low" || priorityRaw === "medium" || priorityRaw === "high" ? priorityRaw : null;
    const visibilityRaw = text(record.visibility, `Action "${title}" → visibility`, issues).toLowerCase();
    const visibility: "internal" | "client" | null =
      visibilityRaw === "internal" || visibilityRaw === "client" ? visibilityRaw : null;
    // Checklist items arrive as plain strings or {text, done} objects.
    const checklist = asArray(record.checklist, `Action "${title}" → checklist`, issues).flatMap((item) => {
      if (typeof item === "string") {
        const itemText = item.trim();
        return itemText && itemText !== NEEDS_CONFIRMATION && itemText !== NOT_APPLICABLE ? [{ text: itemText, done: false }] : [];
      }
      if (typeof item === "object" && item !== null) {
        const record2 = item as Record<string, unknown>;
        const itemText = typeof record2.text === "string" ? record2.text.trim() : "";
        return itemText ? [{ text: itemText, done: record2.done === true }] : [];
      }
      return [];
    });
    return [
      {
        id,
        title,
        description: text(record.description, `Action "${title}" → description`, issues),
        due_date: date(record.due_date, `Action "${title}" → due date`, issues),
        owner_name: text(record.owner, `Action "${title}" → owner`, issues) || null,
        status,
        priority,
        visibility,
        checklist,
      },
    ];
  });

  const metricSnapshots = asArray(doc.metric_snapshots, "Metric snapshots", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const platform = text(record.platform, `Metric snapshot ${i + 1} → platform`, issues);
    const snapshotDate = date(record.snapshot_date, `Metric snapshot ${i + 1} → date`, issues);
    const followers = num(record.followers, `Metric snapshot ${i + 1} → followers`, issues);
    if (!platform || !snapshotDate || followers === null) {
      issues.warnings.push(`Metric snapshot ${i + 1} needs platform, snapshot_date and followers — skipped.`);
      return [];
    }
    const extras: Record<string, number | null> = {};
    for (const key of SNAPSHOT_EXTRAS) {
      if (key in record) extras[key] = num(record[key], `Metric snapshot ${platform} → ${key}`, issues);
    }
    return [{ platform, snapshot_date: snapshotDate, followers, extras }];
  });

  const metricTargets = asArray(doc.metric_targets, "Metric targets", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const platform = text(record.platform, `Metric target ${i + 1} → platform`, issues);
    if (!platform) {
      issues.warnings.push(`Metric target ${i + 1} has no platform — skipped.`);
      return [];
    }
    // Which metric (Duane): free text, normalised to snake_case so
    // "Profile visits" and "profile_visits" are the same target. Older
    // documents that don't say default to followers — the only thing a
    // target could mean before the column existed.
    const rawMetric = text(record.metric, `Target ${platform} → metric`, issues);
    const metric = (rawMetric || "followers").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!rawMetric) issues.warnings.push(`Metric target ${i + 1} (${platform}) has no metric — treated as a followers target.`);
    return [
      {
        platform,
        metric,
        baseline_value: num(record.baseline_value, `Target ${platform} → baseline`, issues),
        target_value: num(record.target_value, `Target ${platform} → target`, issues),
        target_date: date(record.target_date, `Target ${platform} → target date`, issues),
      },
    ];
  });

  const milestones = asArray(doc.milestones, "Timeline milestones", issues).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const title = text(record.title, `Milestone ${i + 1} → title`, issues);
    const milestoneDate = date(record.milestone_date, `Milestone ${i + 1} → date`, issues);
    if (!title || !milestoneDate) {
      issues.warnings.push(`Milestone ${i + 1} needs a title and a date — skipped.`);
      return [];
    }
    return [
      {
        title,
        milestone_date: milestoneDate,
        description: text(record.description, `Milestone "${title}" → description`, issues),
        is_highlighted: record.is_highlighted === true,
      },
    ];
  });

  const KNOWN_KEYS = [
    "pbos_import", "version", "overview", "vision", "positioning", "content_guidelines", "audiences", "social_strategies",
    "content_pillars", "content_ideas", "sales", "authority_opportunities", "consultations", "source_library",
    "actions", "metric_snapshots", "metric_targets", "milestones",
  ];
  for (const key of Object.keys(doc)) {
    if (!KNOWN_KEYS.includes(key)) issues.warnings.push(`Unrecognised top-level section "${key}" ignored.`);
  }

  return {
    ok: true,
    parsed: {
      overview,
      vision: fieldMap(doc.vision, VISION_FIELDS, "Vision", issues),
      positioning: fieldMap(doc.positioning, POSITIONING_FIELDS, "Positioning", issues),
      sales: fieldMap(doc.sales, SALES_FIELDS, "Sales", issues),
      contentGuidelines: fieldMap(doc.content_guidelines, CONTENT_GUIDELINES_FIELDS, "Content guidelines", issues),
      audiences,
      socials,
      pillars,
      contentIdeas,
      authority,
      consultations,
      sourceItems,
      actions,
      metricSnapshots,
      metricTargets,
      milestones,
      sectionModes,
      ...issues,
    },
  };
}

export interface ImportSectionSummary {
  label: string;
  count: number;
  preview: string[];
}

/** What the review screen shows: which sections/records will be created. */
export function summarizeClientImport(parsed: ParsedClientImport): ImportSectionSummary[] {
  const filled = (record: Record<string, string>) => Object.values(record).filter((v) => v.trim()).length;
  const sections: ImportSectionSummary[] = [
    { label: "Overview", count: 1, preview: [parsed.overview.name, parsed.overview.north_star && "North Star set"].filter(Boolean) as string[] },
    { label: "Vision", count: filled(parsed.vision) > 0 ? 1 : 0, preview: [`${filled(parsed.vision)} of ${VISION_FIELDS.length} fields`] },
    { label: "Positioning", count: filled(parsed.positioning) > 0 ? 1 : 0, preview: [`${filled(parsed.positioning)} of ${POSITIONING_FIELDS.length} fields`] },
    { label: "Content guidelines", count: filled(parsed.contentGuidelines) > 0 ? 1 : 0, preview: [`${filled(parsed.contentGuidelines)} of ${CONTENT_GUIDELINES_FIELDS.length} fields`] },
    { label: "Audiences", count: parsed.audiences.length, preview: parsed.audiences.map((a) => a.name) },
    { label: "Social strategies", count: parsed.socials.length, preview: parsed.socials.map((s) => s.platform) },
    { label: "Content pillars", count: parsed.pillars.length, preview: parsed.pillars.map((p) => p.name) },
    { label: "Content ideas", count: parsed.contentIdeas.length, preview: parsed.contentIdeas.map((c) => c.title) },
    { label: "Sales strategy", count: filled(parsed.sales) > 0 ? 1 : 0, preview: [`${filled(parsed.sales)} of ${SALES_FIELDS.length} fields`] },
    { label: "Authority & opportunities", count: parsed.authority.length, preview: parsed.authority.map((a) => `${a.type}${a.host ? ` · ${a.host}` : ""}`) },
    { label: "Meetings & consultations", count: parsed.consultations.length, preview: parsed.consultations.map((c, i) => c.meeting_date ?? `Meeting ${i + 1}`) },
    { label: "Source library", count: parsed.sourceItems.length, preview: parsed.sourceItems.map((s) => `${s.kind}: ${s.text.slice(0, 60)}`) },
    { label: "Actions", count: parsed.actions.length, preview: parsed.actions.map((a) => a.title) },
    { label: "Metric snapshots", count: parsed.metricSnapshots.length, preview: parsed.metricSnapshots.map((m) => `${m.platform} · ${m.snapshot_date}`) },
    { label: "Metric targets", count: parsed.metricTargets.length, preview: parsed.metricTargets.map((m) => m.platform) },
    { label: "Timeline milestones", count: parsed.milestones.length, preview: parsed.milestones.map((m) => m.title) },
  ];
  return sections.filter((s) => s.count > 0);
}
