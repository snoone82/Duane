"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { UserFacingError } from "@/lib/errors";
import {
  parsePlatformStrategyImport,
  matchStrategyAccount,
  STRATEGY_FIELD_LABELS,
  type ParsedStrategyAccount,
} from "@/lib/import/platform-strategy";
import { buildRecordMatcher } from "@/lib/import/record-match";
import { platformRoleLabel, crossPostRuleMeta } from "@/lib/platform-strategy";
import { socialAccountLabel } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type SocialRow = Database["public"]["Tables"]["social_strategies"]["Row"];

export interface StrategyChange {
  column: string;
  label: string;
  from: string;
  to: string;
}

export interface StrategyEntryPreview {
  /** Position in the file — stable, so the same paste re-parses identically. */
  key: string;
  /** What the file said, for the heading. */
  sourceLabel: string;
  /** The account it will be applied to, once known. */
  matchedAccountId: string | null;
  matchedLabel: string | null;
  matchNote: string;
  needsChoice: boolean;
  choices: { id: string; label: string }[];
  changes: StrategyChange[];
  unchanged: number;
  warnings: string[];
}

export interface StrategyImportPreview {
  entries: StrategyEntryPreview[];
  totals: { accounts: number; fields: number; unmatched: number };
  warnings: string[];
}

/** Render a stored value the way the preview should show it. */
function displayValue(column: string, value: unknown, audienceNames: Map<string, string>): string {
  if (value === null || value === undefined || value === "") return "";
  if (column === "platform_role") return platformRoleLabel(String(value)) || String(value);
  if (column === "cross_post_rule") return crossPostRuleMeta(String(value)).short;
  if (column === "primary_audience_id" || column === "secondary_audience_id") {
    return audienceNames.get(String(value)) ?? "(unknown audience)";
  }
  return String(value);
}

/** Resolve one entry into the exact column patch it would apply. */
function buildPatch(
  entry: ParsedStrategyAccount,
  account: SocialRow,
  audiences: { id: string; name: string }[],
  audienceNames: Map<string, string>
): { changes: StrategyChange[]; unchanged: number; warnings: string[]; patch: Record<string, unknown> } {
  const warnings = [...entry.warnings];
  const patch: Record<string, unknown> = {};
  const changes: StrategyChange[] = [];
  let unchanged = 0;

  const proposed: Record<string, unknown> = { ...entry.fields };

  // Audiences are named in prose; resolve them to the client's real records
  // rather than inventing anything.
  const matcher = buildRecordMatcher(audiences.map((a) => ({ id: a.id, name: a.name })));
  const resolveAudience = (name: string | null, column: string, label: string) => {
    if (!name) return;
    const outcome = matcher.match({ name });
    if (outcome.kind === "exact" || outcome.kind === "normalised" || outcome.kind === "id") {
      proposed[column] = outcome.record.id;
    } else if (outcome.kind === "ambiguous") {
      warnings.push(`${label} "${name}" could be more than one of this client's audiences — left unchanged.`);
    } else {
      warnings.push(`${label} "${name}" isn't one of this client's audiences — left unchanged. Add it on the Audiences tab first if it should be.`);
    }
  };
  resolveAudience(entry.primaryAudience, "primary_audience_id", "Primary audience");
  resolveAudience(entry.secondaryAudience, "secondary_audience_id", "Secondary audience");

  for (const [column, value] of Object.entries(proposed)) {
    const current = (account as unknown as Record<string, unknown>)[column];
    const from = displayValue(column, current, audienceNames);
    const to = displayValue(column, value, audienceNames);
    if (String(current ?? "") === String(value ?? "")) {
      unchanged += 1;
      continue;
    }
    patch[column] = value;
    changes.push({ column, label: STRATEGY_FIELD_LABELS[column] ?? column, from, to });
  }

  // Cadence reads as one thing to a human, so don't show the period on its own.
  if (patch.cadence_period !== undefined && patch.cadence_target === undefined) {
    const i = changes.findIndex((c) => c.column === "cadence_period");
    if (i >= 0 && account.cadence_target === 0) {
      changes.splice(i, 1);
      delete patch.cadence_period;
      unchanged += 1;
    }
  }

  return { changes, unchanged, warnings, patch };
}

async function loadContext(clientId: string) {
  const supabase = await createClient();
  const [{ data: accounts }, { data: audiences }] = await Promise.all([
    supabase.from("social_strategies").select("*").eq("client_id", clientId).order("sort_order"),
    supabase.from("audiences").select("id,name").eq("client_id", clientId).order("sort_order"),
  ]);
  const audienceNames = new Map((audiences ?? []).map((a) => [a.id, a.name]));
  return { supabase, accounts: accounts ?? [], audiences: audiences ?? [], audienceNames };
}

/**
 * Preview: every field, current value → imported value, before anything is
 * written. Entries PBOS can't confidently place come back for Duane to
 * assign — it never creates a second account to make an import fit.
 */
export async function previewStrategyImport(
  clientId: string,
  text: string,
  assignments: Record<string, string> = {}
): Promise<ActionResult<StrategyImportPreview>> {
  const result = parsePlatformStrategyImport(text);
  if (!result.ok) return { ok: false, message: result.error };

  return runAction(async () => {
    const { accounts, audiences, audienceNames } = await loadContext(clientId);
    if (!accounts.length) {
      throw new UserFacingError("This client has no social accounts yet — add them on the Social tab first, then import the strategy onto them.");
    }

    const matchable = accounts.map((a) => ({ id: a.id, platform: a.platform, account_name: a.account_name }));
    const choices = accounts.map((a) => ({ id: a.id, label: socialAccountLabel(a.platform, a.account_name) }));

    const entries: StrategyEntryPreview[] = result.parsed.accounts.map((entry, i) => {
      const key = String(i);
      const sourceLabel = socialAccountLabel(entry.platform, entry.accountName) || entry.accountName || entry.platform;

      // A choice made in the preview always wins over the automatic match.
      const chosenId = assignments[key];
      const match = chosenId ? null : matchStrategyAccount(entry, matchable);
      const accountId = chosenId ?? (match && "account" in match ? match.account.id : null);
      const account = accountId ? accounts.find((a) => a.id === accountId) ?? null : null;

      const base: StrategyEntryPreview = {
        key,
        sourceLabel,
        matchedAccountId: accountId,
        matchedLabel: account ? socialAccountLabel(account.platform, account.account_name) : null,
        matchNote: "",
        needsChoice: false,
        choices,
        changes: [],
        unchanged: 0,
        warnings: [...entry.warnings],
      };

      if (!account) {
        base.needsChoice = true;
        base.matchNote =
          match && match.kind === "ambiguous"
            ? `Could be ${match.candidates.length} accounts (${match.candidates.map((c) => socialAccountLabel(c.platform, c.account_name)).join(", ")}) — choose which one.`
            : "No matching account on this client — choose which one this belongs to.";
        return base;
      }

      base.matchNote = chosenId
        ? "You chose this account."
        : match?.kind === "id" ? "Matched by account ID."
        : match?.kind === "name" ? "Matched by account name."
        : "Matched by platform.";

      const built = buildPatch(entry, account, audiences, audienceNames);
      base.changes = built.changes;
      base.unchanged = built.unchanged;
      base.warnings = built.warnings;
      return base;
    });

    return {
      entries,
      totals: {
        accounts: entries.filter((e) => e.matchedAccountId && e.changes.length).length,
        fields: entries.reduce((s, e) => s + e.changes.length, 0),
        unmatched: entries.filter((e) => e.needsChoice).length,
      },
      warnings: result.parsed.warnings,
    };
  });
}

/**
 * Apply it. Every account in the file lands in one operation — Duane's
 * "import all platforms at once". Nothing is created, and any entry still
 * unassigned is skipped rather than guessed at.
 */
export async function commitStrategyImport(
  clientId: string,
  text: string,
  assignments: Record<string, string> = {}
): Promise<ActionResult<{ accountsUpdated: number; fieldsUpdated: number; skipped: string[] }>> {
  const result = parsePlatformStrategyImport(text);
  if (!result.ok) return { ok: false, message: result.error };

  return runAction(async () => {
    const { supabase, accounts, audiences, audienceNames } = await loadContext(clientId);
    const matchable = accounts.map((a) => ({ id: a.id, platform: a.platform, account_name: a.account_name }));

    let accountsUpdated = 0;
    let fieldsUpdated = 0;
    const skipped: string[] = [];

    for (const [i, entry] of result.parsed.accounts.entries()) {
      const key = String(i);
      const label = socialAccountLabel(entry.platform, entry.accountName) || entry.platform;
      const chosenId = assignments[key];
      const match = chosenId ? null : matchStrategyAccount(entry, matchable);
      const accountId = chosenId ?? (match && "account" in match ? match.account.id : null);
      const account = accountId ? accounts.find((a) => a.id === accountId) : undefined;

      if (!account) {
        skipped.push(label);
        continue;
      }

      const { patch, changes } = buildPatch(entry, account, audiences, audienceNames);
      if (!changes.length) continue;

      const { error } = await supabase
        .from("social_strategies")
        .update(patch as Database["public"]["Tables"]["social_strategies"]["Update"])
        .eq("id", account.id)
        .eq("client_id", clientId);
      if (error) throw new UserFacingError(`${label}: ${error.message}`);

      accountsUpdated += 1;
      fieldsUpdated += changes.length;
    }

    revalidatePath(`/clients/${clientId}/social`);
    revalidatePath(`/clients/${clientId}/content`);
    revalidatePath(`/clients/${clientId}`, "layout");
    return { accountsUpdated, fieldsUpdated, skipped };
  });
}
