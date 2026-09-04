import type { ContentStatus } from "@/lib/enums";

/**
 * The Produce action's checklist (Duane, 3 Sep 2026): where PBOS already
 * knows a step happened elsewhere in the system, the item should tick
 * itself — manual ticking is only for what PBOS genuinely can't detect.
 * Nothing here decides UI; this module is the single source of truth for
 * both the seed text and what "done" means, shared by the action that
 * creates the checklist, the sync that keeps it honest, and the components
 * that render it.
 */
export const PRODUCTION_CHECKLIST_STEPS = [
  "Write the draft",
  "Record",
  "Create the media",
  "Edit the content",
  "Complete internal review",
  "Send for client approval",
  "Content approved",
  "Schedule the content",
] as const;

type ProductionSignal = "draft" | "media" | "edit" | "review" | "approval" | "approved" | "schedule";

/**
 * Matches this template and the shorter one (six items, no distinct
 * "Content approved" step) that every production Action created before this
 * change already carries — so an existing Action starts reflecting reality
 * immediately rather than only ones created from here on.
 *
 * "Record" and "Create the media" tick together: PBOS only ever sees the
 * finished file land in the Master media slot, not a separate "recording
 * finished" moment, so both steps go true on the same event. Told to Duane
 * rather than faked as two independent signals.
 */
const PRODUCTION_SIGNAL_BY_TEXT: Record<string, ProductionSignal> = {
  "write the draft": "draft",
  "record": "media",
  "create the media": "media",
  "record / create the media": "media",
  "edit the content": "edit",
  "complete internal review": "review",
  "send for client approval": "approval",
  "content approved": "approved",
  "schedule the content": "schedule",
  "schedule the approved content": "schedule",
};

/**
 * Where a content idea's status sits on the production pipeline, for
 * comparing "has this stage been reached yet". changes_requested ranks
 * alongside ready_for_approval, not below it: reaching ready_for_approval is
 * what "Complete internal review" and "Send for client approval" record,
 * and requesting changes doesn't undo the fact that review happened — it's
 * what the review found. So those two, and "Edit the content" (rank ≥ 2),
 * all stay ticked through a revision round; only "Content approved"
 * (rank ≥ 4) is actually reversible, and un-ticks. This has to match the
 * sync_production_checklist logic in migration 0031's SQL trigger exactly —
 * that trigger handles the one transition (ready_for_approval →
 * ready_to_schedule/changes_requested) a portal client can cause, since
 * portal users have no UPDATE rights on this action; this function handles
 * every other write path.
 *
 * The pre-rework single-word statuses (approved/drafted/created/edited/
 * measured) rank as "idea" — they predate this pipeline and never appear on
 * a content idea created since migration 0013.
 */
const STAGE_RANK: Record<ContentStatus, number> = {
  idea: 0,
  approved: 0,
  drafted: 0,
  created: 0,
  edited: 0,
  measured: 0,
  approved_production: 1,
  in_production: 2,
  changes_requested: 3,
  ready_for_approval: 3,
  ready_to_schedule: 4,
  scheduled: 5,
  published: 5,
};

export interface ProductionChecklistContext {
  /** A draft has been written — the idea has a hook or a body. */
  hasDraft: boolean;
  /** The idea (or, at output level, the version) has media attached. */
  hasMedia: boolean;
  status: ContentStatus;
}

/** Is this checklist item text one PBOS manages automatically? */
export function isProductionChecklistText(text: string): boolean {
  return text.trim().toLowerCase() in PRODUCTION_SIGNAL_BY_TEXT;
}

/**
 * Whether PBOS's own state says this step is done. Null when the text isn't
 * one of the recognised steps — a manually added extra item, left for a
 * person to tick, never touched by the sync.
 */
export function productionChecklistItemDone(text: string, ctx: ProductionChecklistContext): boolean | null {
  const signal = PRODUCTION_SIGNAL_BY_TEXT[text.trim().toLowerCase()];
  if (!signal) return null;
  const rank = STAGE_RANK[ctx.status] ?? 0;
  switch (signal) {
    case "draft":
      return ctx.hasDraft;
    case "media":
      return ctx.hasMedia;
    case "edit":
      return rank >= 2;
    case "review":
    case "approval":
      return rank >= 3;
    case "approved":
      return rank >= 4;
    case "schedule":
      return rank >= 5;
  }
}
