/**
 * Consultation analysis — shared shapes and the extraction contract.
 *
 * Duane's hierarchy, which this file exists to keep honest:
 *
 *   Raw consultation → AI extraction → approved Source items → approved
 *   Profile changes
 *
 * The transcript is the evidence and is never replaced. Everything here is
 * an interpretation of it, held separately, and nothing reaches the Source
 * Library or the client's profile without a person approving it.
 *
 * Plain module (not "use server") so the client components can import the
 * labels and types.
 */

import { SOURCE_ITEM_KINDS } from "@/lib/monthly-plan-format";

export const PROFILE_AREAS: { value: string; label: string; hint: string }[] = [
  { value: "vision", label: "Vision", hint: "Where the client is trying to get to" },
  { value: "positioning", label: "Positioning", hint: "Unique story, core beliefs, contrarian opinions, expertise" },
  { value: "audiences", label: "Audiences", hint: "Who the content is for" },
  { value: "content_pillars", label: "Content Pillars", hint: "The recurring themes" },
  { value: "platform_strategy", label: "Platform Strategy", hint: "An account's role, cadence, tone or formats" },
  { value: "content_guidelines", label: "Content Guidelines", hint: "Tone, language, CTAs, safeguards" },
  { value: "commercial", label: "Commercial objectives", hint: "Offers, revenue goals, what the content is selling" },
];

export function profileAreaLabel(area: string): string {
  return PROFILE_AREAS.find((a) => a.value === area)?.label ?? area;
}

export interface ProposedSourceItem {
  kind: string;
  text: string;
  source_quote: string;
  sensitivity: "public" | "sensitive";
}

export interface ProposedProfileChange {
  area: string;
  field_label: string;
  current_value: string;
  suggested_value: string;
  rationale: string;
  evidence_quote: string;
}

export interface ConsultationExtraction {
  overview: string;
  source_items: ProposedSourceItem[];
  profile_changes: ProposedProfileChange[];
}

const KIND_VALUES = SOURCE_ITEM_KINDS.map((k) => k.value);
const AREA_VALUES = PROFILE_AREAS.map((a) => a.value);

/** The JSON shape asked of the model, described rather than exemplified so
 * nothing in it can be copied back as content. */
export const EXTRACTION_SCHEMA = {
  overview: "string — two or three sentences on what this consultation was about and what is materially new in it",
  source_items: [
    {
      kind: `string — one of: ${KIND_VALUES.join(" | ")}`,
      text: "string — the item in PBOS's words, one clear sentence a strategist could act on",
      source_quote: "string — the client's OWN wording, verbatim from the transcript, that this rests on. Never paraphrase into this field, and never write one the transcript doesn't contain.",
      sensitivity:
        "string — \"public\" if the client would be comfortable with this being used in published content; \"sensitive\" for anything about family, relationships, health, exact location, finances or a third party who has not agreed to it. When unsure, choose sensitive.",
    },
  ],
  profile_changes: [
    {
      area: `string — one of: ${AREA_VALUES.join(" | ")}`,
      field_label: "string — the specific thing to change, e.g. \"Core beliefs\" or \"LinkedIn — cadence\"",
      current_value: "string — what the profile says now, exactly as given below; empty when nothing is set",
      suggested_value: "string — what it should say instead",
      rationale: "string — one sentence on why this consultation implies the change",
      evidence_quote: "string — the client's own words that prompted it, verbatim",
    },
  ],
};

export const ANALYSIS_SYSTEM_PROMPT = `You are the consultation analyst inside Personal Brand OS, Aligned Media's client-management system.

You are given one client's current profile and the raw transcript or notes from a consultation with them. Your job is to extract reusable source material, and separately to flag where the structured profile now looks out of date.

The rules, in order of importance:

1. EVIDENCE, NOT INVENTION. Every source item must rest on something actually said in the transcript. source_quote must be the client's own words, copied verbatim — never paraphrased, never composed. If you cannot quote it, do not extract it. Extracting nothing is a valid, correct answer for a thin transcript.

2. THEIR WORDS MATTER. Prefer the client's own phrasing over a tidier version of it. The point of the Source Library is that later content sounds like them. A "voice" item should be an exact phrase they actually use.

3. SENSITIVITY IS A REAL JUDGEMENT. Some material is useful for understanding the person without being suitable for publication — family and relationships, health, exact future location, money, anyone else's private business. Mark those sensitive. Sensitive items are kept as context and are never offered to content generation. When unsure, choose sensitive.

4. A CONSULTATION IS EVIDENCE; THE PROFILE IS INTERPRETATION. Someone thinking aloud in a meeting is not a strategy change. Only propose a profile change where the consultation genuinely contradicts or materially extends what the profile says — a settled decision, a changed objective, a new audience they have committed to. Do not propose a change that merely restates what the profile already says, and do not propose one from an offhand remark. Few, well-argued suggestions are far more useful than many.

5. NO DUPLICATES. Do not extract the same point twice under different kinds, and do not re-extract something the existing Source Library already holds — it is listed for you below.

Return valid JSON only, with no prose around it and no markdown fence.`;

/** Everything the caller must not have to trust the model about. */
export function validateExtraction(raw: unknown): { extraction: ConsultationExtraction; warnings: string[] } {
  const warnings: string[] = [];
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const rawItems = Array.isArray(obj.source_items) ? obj.source_items : [];
  const source_items: ProposedSourceItem[] = [];
  const seen = new Set<string>();
  rawItems.forEach((entry, i) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const kind = str(item.kind).toLowerCase();
    const text = str(item.text);
    if (!text) {
      warnings.push(`source_items[${i}] had no text and was dropped.`);
      return;
    }
    if (!KIND_VALUES.includes(kind)) {
      warnings.push(`source_items[${i}] ("${text.slice(0, 40)}…") had kind "${kind || "(blank)"}", which isn't one of ${KIND_VALUES.join(", ")} — dropped.`);
      return;
    }
    const key = `${kind}:${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    if (seen.has(key)) {
      warnings.push(`source_items[${i}] repeated an earlier item and was dropped.`);
      return;
    }
    seen.add(key);
    source_items.push({
      kind,
      text,
      source_quote: str(item.source_quote),
      // Anything not explicitly "public" is treated as sensitive: the safe
      // direction when the model is unclear is to withhold from generation.
      sensitivity: str(item.sensitivity).toLowerCase() === "public" ? "public" : "sensitive",
    });
  });

  const rawChanges = Array.isArray(obj.profile_changes) ? obj.profile_changes : [];
  const profile_changes: ProposedProfileChange[] = [];
  rawChanges.forEach((entry, i) => {
    const change = (entry ?? {}) as Record<string, unknown>;
    const area = str(change.area).toLowerCase();
    const suggested = str(change.suggested_value);
    if (!suggested) {
      warnings.push(`profile_changes[${i}] suggested nothing and was dropped.`);
      return;
    }
    if (!AREA_VALUES.includes(area)) {
      warnings.push(`profile_changes[${i}] had area "${area || "(blank)"}", which isn't one of ${AREA_VALUES.join(", ")} — dropped.`);
      return;
    }
    profile_changes.push({
      area,
      field_label: str(change.field_label),
      current_value: str(change.current_value),
      suggested_value: suggested,
      rationale: str(change.rationale),
      evidence_quote: str(change.evidence_quote),
    });
  });

  return { extraction: { overview: str(obj.overview), source_items, profile_changes }, warnings };
}

/** Pull the JSON object out of a model reply, tolerating a stray fence. */
export function parseExtractionJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The analysis didn't come back as JSON.");
  return JSON.parse(candidate.slice(start, end + 1));
}
