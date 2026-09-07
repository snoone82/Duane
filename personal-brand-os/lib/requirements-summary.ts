/**
 * The month's Production Summary (Duane, after running September end to end).
 *
 *   Summary          = operational overview — what are we making, what do we
 *                      need from the client, what is waiting
 *   Requirement rows = working detail — owners, due dates, related content
 *
 * Computed from the same Master Content and Platform Output rows the
 * requirement reconciler reads, using the same shared rules
 * (productionGroupFor, ctaDestinationState, isMasterBlocked), so the summary
 * and the rows beneath it cannot drift apart. Pure module — no database, no
 * "use server" — so the page can render it and a test can exercise it.
 */

import {
  ctaDestinationState,
  formatNoun,
  isMasterBlocked,
  productionGroupFor,
  type ProductionGroup,
} from "@/lib/monthly-plan-format";

export interface SummaryIdea {
  id: string;
  cta: string;
  cta_destination: string;
  client_requirements: string;
  source_evidence: string;
}

export interface SummaryOutput {
  content_id: string;
  platform: string;
  format: string;
}

export interface ProductionLine {
  /** "10 Shorts" */
  label: string;
  /** "YouTube" — the platforms this work lands on, for context. */
  platforms: string;
  count: number;
}

export interface DecisionLine {
  label: string;
  count: number;
}

export interface RequirementsSummary {
  decisions: DecisionLine[];
  groups: { group: ProductionGroup; heading: string; lines: ProductionLine[] }[];
  totals: {
    planned: number;
    productionReady: number;
    waitingOnClient: number;
    blocked: number;
  };
}

const GROUP_HEADINGS: Record<ProductionGroup, string> = {
  filming: "Filming",
  long_form: "Long-form",
  assets: "Assets",
  writing: "Writing",
};

const GROUP_ORDER: ProductionGroup[] = ["filming", "long_form", "assets", "writing"];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function summariseRequirements(ideas: SummaryIdea[], outputs: SummaryOutput[]): RequirementsSummary {
  const ideaById = new Map(ideas.map((idea) => [idea.id, idea]));
  const blockedIdeaIds = new Set(ideas.filter((idea) => isMasterBlocked(idea)).map((idea) => idea.id));
  const needsInputIdeaIds = new Set(ideas.filter((idea) => idea.client_requirements.trim()).map((idea) => idea.id));

  // --- What the client has to decide or supply -----------------------------
  const decisions: DecisionLine[] = [];
  let ctaConfirm = 0;
  let ctaMissing = 0;
  for (const idea of ideas) {
    // A blocked item's CTA is a question for later — the item itself can't be
    // produced yet, so asking about its destination is premature work.
    if (blockedIdeaIds.has(idea.id)) continue;
    const state = ctaDestinationState(idea);
    if (state === "needs_confirmation") ctaConfirm += 1;
    else if (state === "missing") ctaMissing += 1;
  }
  if (ctaConfirm > 0) {
    decisions.push({ label: `${ctaConfirm} CTA ${plural(ctaConfirm, "destination", "destinations")} to confirm`, count: ctaConfirm });
  }
  if (needsInputIdeaIds.size > 0) {
    decisions.push({
      label: `${needsInputIdeaIds.size} Master Content ${plural(needsInputIdeaIds.size, "item needs", "items need")} client input`,
      count: needsInputIdeaIds.size,
    });
  }
  if (blockedIdeaIds.size > 0) {
    decisions.push({
      label: `${blockedIdeaIds.size} Master Content ${plural(blockedIdeaIds.size, "item needs", "items need")} personal input before anything can be produced`,
      count: blockedIdeaIds.size,
    });
  }
  if (ctaMissing > 0) {
    decisions.push({
      label: `${ctaMissing} Master Content ${plural(ctaMissing, "item has", "items have")} a CTA but no destination set`,
      count: ctaMissing,
    });
  }

  // --- What we are actually producing --------------------------------------
  // Blocked outputs are excluded: they raise no production work until the
  // block clears, exactly as they raise no requirement row.
  const byFormat = new Map<string, { group: ProductionGroup; count: number; platforms: Set<string> }>();
  for (const output of outputs) {
    if (blockedIdeaIds.has(output.content_id)) continue;
    const group = productionGroupFor(output.format);
    if (!group) continue;
    const key = output.format.trim().toLowerCase();
    const bucket = byFormat.get(key) ?? { group, count: 0, platforms: new Set<string>() };
    bucket.count += 1;
    if (output.platform.trim()) bucket.platforms.add(output.platform.trim());
    byFormat.set(key, bucket);
  }

  const groups = GROUP_ORDER.map((group) => ({
    group,
    heading: GROUP_HEADINGS[group],
    lines: [...byFormat.entries()]
      .filter(([, bucket]) => bucket.group === group)
      .map(([format, bucket]) => ({
        label: `${bucket.count} ${formatNoun(format, bucket.count)}`,
        platforms: [...bucket.platforms].sort().join(", "),
        count: bucket.count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  })).filter((entry) => entry.lines.length > 0);

  // --- Where the month stands ----------------------------------------------
  // Blocked and waiting are different states and mustn't be conflated:
  // blocked means we cannot write it at all until the client tells us
  // something; waiting means it is written but needs something from them
  // before it can be produced. Blocked wins where an item is both.
  let blocked = 0;
  let waitingOnClient = 0;
  let productionReady = 0;
  for (const output of outputs) {
    if (!ideaById.has(output.content_id)) continue;
    if (blockedIdeaIds.has(output.content_id)) blocked += 1;
    else if (needsInputIdeaIds.has(output.content_id)) waitingOnClient += 1;
    else productionReady += 1;
  }

  return {
    decisions,
    groups,
    totals: { planned: blocked + waitingOnClient + productionReady, productionReady, waitingOnClient, blocked },
  };
}
