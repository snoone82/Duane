/**
 * The Client View — PBOS *showing* the month.
 *
 * Duane's model, and the reason this file has no AI in it at all:
 *
 *   Stage 1 = What   AI generates the Master Content
 *   Stage 2 = How    AI generates the Platform Outputs
 *   Client View      a live render of the records that already exist
 *
 * It is deliberately NOT "Stage 3": stages are actions you run once, this is
 * a view you open repeatedly — before dates, after dates, after comments.
 * Everything here is a projection of the same MonthlyPlanExport the
 * Structured Plan Export produces, so there is one dataset behind both and
 * nothing is composed, summarised or rewritten at render time.
 */

import type { MonthlyPlanExport } from "@/lib/actions/monthly-plans";

/** Fields that must never reach a client-facing render. Listed rather than
 * relied on by omission so the rule is visible and greppable. */
export const INTERNAL_ONLY_FIELDS = [
  "source_evidence",
  "adaptation_note",
  "media_brief",
  "caption",
  "lead_draft_copy",
  "notes",
  "origin",
] as const;

export interface ClientViewOutput {
  /** "LinkedIn — Daniel Andrews", or the platform family when no account. */
  account: string;
  format: string;
  publishDate: string | null;
}

export interface ClientViewItem {
  sequence: string;
  title: string;
  hook: string;
  /** The plain-English line written at Stage 1 for this view; falls back to
   * the core message when an older idea predates the field. */
  summary: string;
  purpose: string;
  whyNow: string;
  pillar: string | null;
  audience: string | null;
  cta: string;
  /** Only shown when it is a real destination — "Needs confirmation" is an
   * internal state and means nothing to a client. */
  ctaDestination: string | null;
  publishDate: string | null;
  /** "We need this from you" — the actual ask, positively framed. */
  weNeedFromYou: string[];
  outputs: ClientViewOutput[];
}

export interface ClientView {
  clientName: string;
  periodLabel: string;
  primaryObjective: string;
  items: ClientViewItem[];
  /** Production requirements worth a client seeing — assets and information
   * they are involved in, not the internal filming schedule. */
  clientRequirements: { description: string; relatedTo: string }[];
  datesAssigned: boolean;
  totals: { items: number; outputs: number };
}

/** Everything the client actually signed off, in the order it is rendered.
 * Used for both the view and the approval fingerprint, so the two can never
 * describe different things. */
export function buildClientView(doc: MonthlyPlanExport): ClientView {
  const items: ClientViewItem[] = doc.master_content.map((idea) => {
    const weNeedFromYou: string[] = [];
    if (idea.client_requirements.trim()) weNeedFromYou.push(idea.client_requirements.trim());
    // The provenance flag is internal wording; what the client needs to know
    // is the ask, not the sentinel.
    if (idea.source_evidence.toUpperCase().includes("PERSONAL_INPUT_REQUIRED")) {
      weNeedFromYou.push("A real story or example from you for this one — we haven't written anything in its place.");
    }
    if (idea.cta_destination_state === "needs_confirmation") {
      weNeedFromYou.push(`Where should "${idea.cta}" send people? We need the link to use.`);
    }

    return {
      sequence: idea.sequence,
      title: idea.title,
      hook: idea.hook,
      summary: idea.client_summary?.trim() || idea.core_message,
      purpose: idea.purpose,
      whyNow: idea.why_now,
      pillar: idea.pillar,
      audience: idea.audience,
      cta: idea.cta,
      ctaDestination: idea.cta_destination_state === "confirmed" ? idea.cta_destination : null,
      publishDate: idea.target_publish_date,
      weNeedFromYou,
      outputs: idea.platform_outputs.map((output) => ({
        account: output.account_label || output.platform,
        format: output.format,
        publishDate: output.target_publish_date,
      })),
    };
  });

  const outputCount = items.reduce((sum, item) => sum + item.outputs.length, 0);
  // Dates are a property of the outputs — "assigned" means the scheduler has
  // run, which is what gates Approve Month.
  const datesAssigned =
    outputCount > 0 && items.every((item) => item.outputs.every((output) => Boolean(output.publishDate)));

  // Only the requirement types a client has any part in. Filming schedules
  // and internal sourcing are the team's business.
  const clientRequirements = doc.requirements
    .filter((requirement) => requirement.type === "information" || requirement.type === "decision_approval" || requirement.type === "asset_upload")
    .filter((requirement) => requirement.state !== "done")
    .map((requirement) => ({ description: requirement.description, relatedTo: requirement.related_content_note }));

  return {
    clientName: doc.client.name,
    periodLabel: doc.period_label,
    primaryObjective: doc.client_snapshot.primary_objective,
    items,
    clientRequirements,
    datesAssigned,
    totals: { items: items.length, outputs: outputCount },
  };
}

/**
 * A stable fingerprint of everything the client can see.
 *
 * Duane: approval must be tied to the version approved, not just a date. So
 * this covers exactly the client-visible fields — title, hook, summary, CTA,
 * platform, format, publish date and the asks — and deliberately nothing
 * else. Editing an internal production note, a media brief or an
 * adaptation note leaves this unchanged and so never invalidates a
 * signed-off month.
 */
export function clientVisibleFingerprint(view: ClientView): string {
  const parts: string[] = [view.periodLabel, view.primaryObjective];
  for (const item of view.items) {
    parts.push(
      [
        item.sequence,
        item.title,
        item.hook,
        item.summary,
        item.purpose,
        item.whyNow,
        item.pillar ?? "",
        item.audience ?? "",
        item.cta,
        item.ctaDestination ?? "",
        item.publishDate ?? "",
        item.weNeedFromYou.join("|"),
        item.outputs.map((o) => `${o.account}/${o.format}/${o.publishDate ?? ""}`).join("|"),
      ].join("")
    );
  }
  return hash(parts.join(""));
}

/** FNV-1a, 32-bit, as hex. Not cryptographic — this only needs to change
 * whenever the content changes, and to be identical for identical content
 * across renders. */
function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16).padStart(8, "0");
}
