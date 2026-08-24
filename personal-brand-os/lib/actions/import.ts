"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import {
  parseClientImport,
  summarizeClientImport,
  type ImportSectionSummary,
} from "@/lib/import/client-profile";
import { parseContentImport } from "@/lib/import/content";
import type { Database } from "@/lib/database.types";

// ---------------------------------------------------------------------------
// Client Profile Import (§1)
// ---------------------------------------------------------------------------

export interface ClientImportPreview {
  clientName: string;
  sections: ImportSectionSummary[];
  needsConfirmation: string[];
  warnings: string[];
  duplicateWarning: string | null;
}

/** Validation + preview, nothing written. The same text is re-parsed at
 * commit time, so nothing has to survive between the two calls. */
export async function previewClientImport(text: string): Promise<ActionResult<ClientImportPreview>> {
  const result = parseClientImport(text);
  if (!result.ok) return { ok: false, message: result.error };
  const parsed = result.parsed;

  return runAction(async () => {
    const supabase = await createClient();
    const { data: existing } = await supabase.from("clients").select("name,email");
    const lowerName = parsed.overview.name.toLowerCase();
    const duplicate = (existing ?? []).find(
      (c) =>
        c.name.toLowerCase() === lowerName ||
        (parsed.overview.email && c.email && c.email.toLowerCase() === parsed.overview.email.toLowerCase())
    );

    return {
      clientName: parsed.overview.name,
      sections: summarizeClientImport(parsed),
      needsConfirmation: parsed.needsConfirmation,
      warnings: parsed.warnings,
      duplicateWarning: duplicate
        ? `A client called "${duplicate.name}" already exists — importing will create a second, separate client. Double-check before confirming.`
        : null,
    };
  });
}

export async function commitClientImport(text: string): Promise<ActionResult<{ clientId: string; created: string[] }>> {
  const result = parseClientImport(text);
  if (!result.ok) return { ok: false, message: result.error };
  const parsed = result.parsed;

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: parsed.overview.name,
        email: parsed.overview.email,
        phone: parsed.overview.phone,
        company: parsed.overview.company,
        job_title: parsed.overview.job_title,
        industry: parsed.overview.industry,
        location: parsed.overview.location,
        package: parsed.overview.package,
        retainer_amount: parsed.overview.retainer_amount,
        north_star: parsed.overview.north_star,
        notes: parsed.overview.notes,
        website_url: parsed.overview.website_url,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (clientError) throw new Error(clientError.message);
    const clientId = client.id;
    const created: string[] = ["Client profile"];

    // Everything below is best understood as one logical transaction; if any
    // step fails we delete the client, which cascades to whatever was made.
    try {
      const step = async (label: string, fn: () => Promise<void>, count?: number) => {
        await fn();
        if (count === undefined || count > 0) created.push(count === undefined ? label : `${label} (${count})`);
      };

      const filled = (record: Record<string, string>) => Object.values(record).some((v) => v.trim());

      if (filled(parsed.vision)) {
        await step("Vision", async () => {
          const { error } = await supabase.from("brand_vision").update(parsed.vision as Database["public"]["Tables"]["brand_vision"]["Update"]).eq("client_id", clientId);
          if (error) throw new Error(`Vision: ${error.message}`);
        });
      }
      if (filled(parsed.positioning)) {
        await step("Positioning", async () => {
          const { error } = await supabase.from("positioning").update(parsed.positioning as Database["public"]["Tables"]["positioning"]["Update"]).eq("client_id", clientId);
          if (error) throw new Error(`Positioning: ${error.message}`);
        });
      }
      if (filled(parsed.sales)) {
        await step("Sales strategy", async () => {
          const { error } = await supabase.from("sales_strategy").update(parsed.sales as Database["public"]["Tables"]["sales_strategy"]["Update"]).eq("client_id", clientId);
          if (error) throw new Error(`Sales: ${error.message}`);
        });
      }

      const audienceIds = new Map<string, string>();
      if (parsed.audiences.length > 0) {
        await step(
          "Audiences",
          async () => {
            const { data, error } = await supabase
              .from("audiences")
              .insert(parsed.audiences.map((a, i) => ({ client_id: clientId, ...a.fields, name: a.name, sort_order: i })))
              .select("id,name");
            if (error) throw new Error(`Audiences: ${error.message}`);
            for (const row of data ?? []) audienceIds.set(row.name.toLowerCase(), row.id);
          },
          parsed.audiences.length
        );
      }

      const pillarIds = new Map<string, string>();
      if (parsed.pillars.length > 0) {
        await step(
          "Content pillars",
          async () => {
            const { data, error } = await supabase
              .from("brand_pillars")
              .insert(parsed.pillars.map((p, i) => ({ client_id: clientId, ...p.fields, name: p.name, sort_order: i })))
              .select("id,name");
            if (error) throw new Error(`Pillars: ${error.message}`);
            for (const row of data ?? []) pillarIds.set(row.name.toLowerCase(), row.id);
          },
          parsed.pillars.length
        );
      }

      if (parsed.socials.length > 0) {
        await step(
          "Social strategies",
          async () => {
            const { error } = await supabase
              .from("social_strategies")
              .insert(parsed.socials.map((s, i) => ({ client_id: clientId, ...s.fields, platform: s.platform, sort_order: i })));
            if (error) throw new Error(`Social strategies: ${error.message}`);
          },
          parsed.socials.length
        );
      }

      if (parsed.contentIdeas.length > 0) {
        await step(
          "Content ideas",
          async () => {
            for (const idea of parsed.contentIdeas) {
              const { data: row, error } = await supabase
                .from("content_ideas")
                .insert({
                  client_id: clientId,
                  title: idea.title,
                  hook: idea.hook,
                  body: idea.body,
                  notes: idea.notes,
                  priority: idea.priority,
                  pillar_id: idea.pillar ? (pillarIds.get(idea.pillar.toLowerCase()) ?? null) : null,
                  audience_id: idea.audience ? (audienceIds.get(idea.audience.toLowerCase()) ?? null) : null,
                  created_by: user?.id ?? null,
                })
                .select("id")
                .single();
              if (error) throw new Error(`Content idea "${idea.title}": ${error.message}`);
              if (idea.platforms.length > 0) {
                const { error: outputError } = await supabase.from("content_outputs").insert(
                  idea.platforms.map((platform, i) => ({
                    content_id: row.id,
                    client_id: clientId,
                    platform,
                    sort_order: i,
                  }))
                );
                if (outputError) throw new Error(`Content idea "${idea.title}" platforms: ${outputError.message}`);
              }
            }
          },
          parsed.contentIdeas.length
        );
      }

      if (parsed.authority.length > 0) {
        await step(
          "Authority & opportunities",
          async () => {
            const { error } = await supabase.from("authority_opportunities").insert(
              parsed.authority.map((a) => ({
                client_id: clientId,
                type: a.type,
                host: a.host,
                status: a.status as "identified",
                opportunity_date: a.opportunity_date,
                audience_size: a.audience_size,
                contact_name: a.contact_name,
                contact_email: a.contact_email,
                notes: a.notes,
              }))
            );
            if (error) throw new Error(`Authority: ${error.message}`);
          },
          parsed.authority.length
        );
      }

      if (parsed.consultations.length > 0) {
        await step(
          "Meetings & consultations",
          async () => {
            const { error } = await supabase.from("consultations").insert(
              parsed.consultations.map((c) => {
                const fields = { ...c.fields };
                const next_meeting_date = fields.next_meeting_date;
                delete fields.meeting_date;
                delete fields.next_meeting_date;
                return {
                  client_id: clientId,
                  ...fields,
                  meeting_date: c.meeting_date ?? new Date().toISOString().slice(0, 10),
                  next_meeting_date: next_meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(next_meeting_date) ? next_meeting_date : null,
                  created_by: user?.id ?? null,
                };
              })
            );
            if (error) throw new Error(`Consultations: ${error.message}`);
          },
          parsed.consultations.length
        );
      }

      // action_id entries are update references — meaningless on a brand-new
      // client, so they're dropped here.
      const actionRows = parsed.actions.filter((a) => !a.id).map((a) => ({
        client_id: clientId,
        title: a.title,
        description: a.description,
        due_date: a.due_date,
        owner_name: a.owner_name,
        owner_user_id: a.owner_name ? null : (user?.id ?? null),
        status: a.status ?? "not_started",
        completed_at: a.status === "completed" ? new Date().toISOString() : null,
        priority: a.priority ?? "medium",
        source: "import",
        checklist: [] as { text: string; done: boolean }[],
      }));
      // The follow-up list Duane asked for: everything the AI marked as
      // needing the client's word becomes one action with a checklist.
      if (parsed.needsConfirmation.length > 0) {
        actionRows.push({
          client_id: clientId,
          title: "Confirm outstanding profile details with client",
          description: "Fields the consultation import couldn't confirm — check them with the client and fill them in.",
          due_date: null,
          owner_name: null,
          owner_user_id: user?.id ?? null,
          status: "not_started",
          completed_at: null,
          priority: "medium",
          source: "client_confirmation",
          checklist: parsed.needsConfirmation.map((label) => ({ text: label, done: false })),
        });
      }
      if (actionRows.length > 0) {
        await step(
          "Actions",
          async () => {
            const { error } = await supabase
              .from("actions")
              .insert(actionRows as Database["public"]["Tables"]["actions"]["Insert"][]);
            if (error) throw new Error(`Actions: ${error.message}`);
          },
          actionRows.length
        );
      }

      if (parsed.metricSnapshots.length > 0) {
        await step(
          "Metric snapshots",
          async () => {
            const { error } = await supabase.from("metric_snapshots").insert(
              parsed.metricSnapshots.map((m) => ({
                client_id: clientId,
                platform: m.platform,
                snapshot_date: m.snapshot_date,
                followers: m.followers,
                ...m.extras,
              }))
            );
            if (error) throw new Error(`Metric snapshots: ${error.message}`);
          },
          parsed.metricSnapshots.length
        );
      }

      if (parsed.metricTargets.length > 0) {
        await step(
          "Metric targets",
          async () => {
            const { error } = await supabase
              .from("metric_targets")
              .insert(parsed.metricTargets.map((m) => ({ client_id: clientId, ...m })));
            if (error) throw new Error(`Metric targets: ${error.message}`);
          },
          parsed.metricTargets.length
        );
      }

      if (parsed.milestones.length > 0) {
        await step(
          "Timeline milestones",
          async () => {
            const { error } = await supabase
              .from("milestones")
              .insert(parsed.milestones.map((m) => ({ client_id: clientId, ...m })));
            if (error) throw new Error(`Milestones: ${error.message}`);
          },
          parsed.milestones.length
        );
      }
    } catch (error) {
      // Roll the whole import back — deleting the client cascades to
      // everything created above.
      await supabase.from("clients").delete().eq("id", clientId);
      throw error;
    }

    revalidatePath("/clients");
    revalidatePath("/");
    return { clientId, created };
  });
}

// ---------------------------------------------------------------------------
// Update existing client via import (Duane's follow-up ask). Same format as
// the create import — the AI includes only the sections that changed. Merge
// semantics: provided non-empty values update matching records; unmatched
// repeatable records are created; nothing is ever blanked or deleted; the
// client is matched by its internal id (the page you're on), never by name.
// Re-running the same import is safe — matching makes it a no-op.
// ---------------------------------------------------------------------------

export interface UpdateSection {
  label: string;
  /** "Field: old → new" style lines. */
  updates: string[];
  /** New records that will be created. */
  creates: string[];
  /** Records skipped (duplicates / already present). */
  skips: string[];
}

export interface ClientUpdatePreview {
  clientName: string;
  nameMismatch: string | null;
  sections: UpdateSection[];
  needsConfirmation: string[];
  warnings: string[];
}

const clip = (value: string, length = 60) => (value.length > length ? `${value.slice(0, length)}…` : value) || "(blank)";

type UpdatePlan = {
  preview: ClientUpdatePreview;
  apply: () => Promise<void>;
};

/** Shared by preview and commit so what you saw is exactly what runs. */
async function buildClientUpdatePlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  text: string,
  userId: string | null
): Promise<{ ok: true; plan: UpdatePlan } | { ok: false; message: string }> {
  const result = parseClientImport(text, { requireName: false });
  if (!result.ok) return { ok: false, message: result.error };
  const parsed = result.parsed;

  const [
    { data: client },
    { data: vision },
    { data: positioning },
    { data: sales },
    { data: audiences },
    { data: socials },
    { data: pillars },
    { data: ideas },
    { data: authority },
    { data: consultations },
    { data: actions },
    { data: snapshots },
    { data: targets },
    { data: milestones },
    { data: profilesList },
    { data: membersList },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("brand_vision").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("positioning").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("sales_strategy").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("audiences").select("id,name").eq("client_id", clientId),
    supabase.from("social_strategies").select("id,platform,account_name").eq("client_id", clientId),
    supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
    supabase.from("content_ideas").select("id,title").eq("client_id", clientId),
    supabase.from("authority_opportunities").select("id,type,host").eq("client_id", clientId),
    supabase.from("consultations").select("id,meeting_date,meeting_type").eq("client_id", clientId),
    supabase
      .from("actions")
      .select("id,title,status,owner_name,owner_user_id,due_date,priority,description,checklist")
      .eq("client_id", clientId),
    supabase.from("metric_snapshots").select("id,platform,snapshot_date").eq("client_id", clientId),
    supabase.from("metric_targets").select("id,platform").eq("client_id", clientId),
    supabase.from("milestones").select("id,title,milestone_date").eq("client_id", clientId),
    supabase.from("profiles").select("id,full_name,email,role").in("role", ["admin", "member", "contractor"]),
    supabase.from("client_members").select("name,user_id").eq("client_id", clientId),
  ]);
  if (!client) return { ok: false, message: "Client not found (or you don't have access to it)." };

  const sections: UpdateSection[] = [];
  const work: (() => Promise<void>)[] = [];
  const fail = (label: string, message: string) => new Error(`${label}: ${message}`);

  // --- Overview + the three singleton strategy tables: field-level merge ---
  type ScalarPatch = Record<string, string | number>;
  const scalarSection = <T extends Record<string, unknown>>(
    label: string,
    current: T | null,
    provided: Record<string, string | number | null>,
    run: (patch: ScalarPatch) => PromiseLike<{ error: { message: string } | null }>
  ) => {
    if (!current) return;
    const updates: string[] = [];
    const patch: ScalarPatch = {};
    for (const [key, raw] of Object.entries(provided)) {
      if (raw === null || raw === "" || raw === undefined) continue; // blanks never overwrite
      const existing = current[key];
      if (String(existing ?? "") === String(raw)) continue;
      patch[key] = raw;
      updates.push(`${key.replace(/_/g, " ")}: ${clip(String(existing ?? ""))} → ${clip(String(raw))}`);
    }
    if (updates.length === 0) return;
    sections.push({ label, updates, creates: [], skips: [] });
    work.push(async () => {
      const { error } = await run(patch);
      if (error) throw fail(label, error.message);
    });
  };

  type Tables = Database["public"]["Tables"];
  scalarSection("Overview", client, { ...parsed.overview, name: parsed.overview.name || null }, (patch) =>
    supabase.from("clients").update(patch as Tables["clients"]["Update"]).eq("id", clientId)
  );
  scalarSection("Vision", vision, parsed.vision, (patch) =>
    supabase.from("brand_vision").update(patch as Tables["brand_vision"]["Update"]).eq("client_id", clientId)
  );
  scalarSection("Positioning", positioning, parsed.positioning, (patch) =>
    supabase.from("positioning").update(patch as Tables["positioning"]["Update"]).eq("client_id", clientId)
  );
  scalarSection("Sales strategy", sales, parsed.sales, (patch) =>
    supabase.from("sales_strategy").update(patch as Tables["sales_strategy"]["Update"]).eq("client_id", clientId)
  );

  // --- Repeatable records: match on a natural key; update matches, create
  // the rest, never delete. ---
  const repeatable = <P>(
    label: string,
    items: P[],
    matchExisting: (item: P) => { id: string } | undefined,
    itemLabel: (item: P) => string,
    fields: (item: P) => Record<string, string>,
    insert: (toCreate: P[]) => Promise<void>,
    update: (id: string, patch: Record<string, string>, item: P) => Promise<void>
  ) => {
    if (items.length === 0) return;
    const section: UpdateSection = { label, updates: [], creates: [], skips: [] };
    const toCreate: P[] = [];
    for (const item of items) {
      const existing = matchExisting(item);
      if (!existing) {
        toCreate.push(item);
        section.creates.push(itemLabel(item));
        continue;
      }
      const patch: Record<string, string> = {};
      for (const [key, value] of Object.entries(fields(item))) {
        if (value.trim()) patch[key] = value;
      }
      if (Object.keys(patch).length === 0) {
        section.skips.push(`${itemLabel(item)} — nothing new`);
        continue;
      }
      section.updates.push(`${itemLabel(item)} (${Object.keys(patch).map((k) => k.replace(/_/g, " ")).join(", ")})`);
      work.push(() => update(existing.id, patch, item));
    }
    if (toCreate.length > 0) work.push(() => insert(toCreate));
    if (section.updates.length + section.creates.length + section.skips.length > 0) sections.push(section);
  };

  const lower = (value: string) => value.trim().toLowerCase();
  const audienceByName = new Map((audiences ?? []).map((a) => [lower(a.name), a]));
  const pillarByName = new Map((pillars ?? []).map((p) => [lower(p.name), p]));

  // Multi-account social (migration 0017): the natural key is platform +
  // account name. A row with no account name still matches by platform alone
  // when the client has exactly one account on that platform.
  const socialKey = (platform: string, account: string) => `${lower(platform)}|${lower(account)}`;
  const socialByKey = new Map((socials ?? []).map((s) => [socialKey(s.platform, s.account_name), s]));
  const matchSocial = (item: { platform: string; fields: Record<string, string> }) => {
    const account = item.fields.account_name ?? "";
    const exact = socialByKey.get(socialKey(item.platform, account));
    if (exact) return exact;
    if (!account.trim()) {
      const samePlatform = (socials ?? []).filter((s) => lower(s.platform) === lower(item.platform));
      if (samePlatform.length === 1) return samePlatform[0];
    }
    return undefined;
  };

  repeatable(
    "Audiences",
    parsed.audiences,
    (a) => audienceByName.get(lower(a.name)),
    (a) => a.name,
    (a) => a.fields,
    async (create) => {
      const { error } = await supabase
        .from("audiences")
        .insert(create.map((a, i) => ({ client_id: clientId, ...a.fields, name: a.name, sort_order: (audiences?.length ?? 0) + i })));
      if (error) throw fail("Audiences", error.message);
    },
    async (id, patch) => {
      const { error } = await supabase.from("audiences").update(patch as Tables["audiences"]["Update"]).eq("id", id);
      if (error) throw fail("Audiences", error.message);
    }
  );

  repeatable(
    "Social strategies",
    parsed.socials,
    matchSocial,
    (s) => (s.fields.account_name ? `${s.platform} — ${s.fields.account_name}` : s.platform),
    (s) => s.fields,
    async (create) => {
      const { error } = await supabase
        .from("social_strategies")
        .insert(create.map((s, i) => ({ client_id: clientId, ...s.fields, platform: s.platform, sort_order: (socials?.length ?? 0) + i })));
      if (error) throw fail("Social strategies", error.message);
    },
    async (id, patch) => {
      const { error } = await supabase.from("social_strategies").update(patch as Tables["social_strategies"]["Update"]).eq("id", id);
      if (error) throw fail("Social strategies", error.message);
    }
  );

  repeatable(
    "Content pillars",
    parsed.pillars,
    (p) => pillarByName.get(lower(p.name)),
    (p) => p.name,
    (p) => p.fields,
    async (create) => {
      const { error } = await supabase
        .from("brand_pillars")
        .insert(create.map((p, i) => ({ client_id: clientId, ...p.fields, name: p.name, sort_order: (pillars?.length ?? 0) + i })));
      if (error) throw fail("Content pillars", error.message);
    },
    async (id, patch) => {
      const { error } = await supabase.from("brand_pillars").update(patch as Tables["brand_pillars"]["Update"]).eq("id", id);
      if (error) throw fail("Content pillars", error.message);
    }
  );

  // --- Create-only records: existing matches are duplicates to skip. ---
  const ideaTitles = new Set((ideas ?? []).map((i) => lower(i.title)));
  if (parsed.contentIdeas.length > 0) {
    const section: UpdateSection = { label: "Content ideas", updates: [], creates: [], skips: [] };
    const fresh = parsed.contentIdeas.filter((idea) => {
      if (ideaTitles.has(lower(idea.title))) {
        section.skips.push(`${idea.title} — already in the pipeline (use Import content to work on content)`);
        return false;
      }
      section.creates.push(idea.title);
      return true;
    });
    if (fresh.length > 0) {
      work.push(async () => {
        for (const idea of fresh) {
          const { data: row, error } = await supabase
            .from("content_ideas")
            .insert({
              client_id: clientId,
              title: idea.title,
              hook: idea.hook,
              body: idea.body,
              notes: idea.notes,
              priority: idea.priority,
              pillar_id: idea.pillar ? (pillarByName.get(lower(idea.pillar))?.id ?? null) : null,
              audience_id: idea.audience ? (audienceByName.get(lower(idea.audience))?.id ?? null) : null,
              created_by: userId,
            })
            .select("id")
            .single();
          if (error) throw fail("Content ideas", error.message);
          if (idea.platforms.length > 0) {
            const { error: outputError } = await supabase
              .from("content_outputs")
              .insert(idea.platforms.map((platform, i) => ({ content_id: row.id, client_id: clientId, platform, sort_order: i })));
            if (outputError) throw fail("Content ideas", outputError.message);
          }
        }
      });
    }
    sections.push(section);
  }

  const authorityKey = (type: string, host: string | null) => `${lower(type)}|${lower(host ?? "")}`;
  const authorityKeys = new Set((authority ?? []).map((a) => authorityKey(a.type, a.host)));
  if (parsed.authority.length > 0) {
    const section: UpdateSection = { label: "Authority & opportunities", updates: [], creates: [], skips: [] };
    const fresh = parsed.authority.filter((a) => {
      const label = `${a.type}${a.host ? ` · ${a.host}` : ""}`;
      if (authorityKeys.has(authorityKey(a.type, a.host))) {
        section.skips.push(`${label} — already tracked`);
        return false;
      }
      section.creates.push(label);
      return true;
    });
    if (fresh.length > 0) {
      work.push(async () => {
        const { error } = await supabase.from("authority_opportunities").insert(
          fresh.map((a) => ({
            client_id: clientId,
            type: a.type,
            host: a.host,
            status: a.status as "identified",
            opportunity_date: a.opportunity_date,
            audience_size: a.audience_size,
            contact_name: a.contact_name,
            contact_email: a.contact_email,
            notes: a.notes,
          }))
        );
        if (error) throw fail("Authority & opportunities", error.message);
      });
    }
    sections.push(section);
  }

  const consultationKeys = new Set((consultations ?? []).map((c) => `${c.meeting_date}|${lower(c.meeting_type ?? "")}`));
  if (parsed.consultations.length > 0) {
    const section: UpdateSection = { label: "Meetings & consultations", updates: [], creates: [], skips: [] };
    const fresh = parsed.consultations.filter((c, i) => {
      const meetingDate = c.meeting_date ?? new Date().toISOString().slice(0, 10);
      const label = `${meetingDate}${c.fields.meeting_type ? ` · ${c.fields.meeting_type}` : ""}`;
      if (consultationKeys.has(`${meetingDate}|${lower(c.fields.meeting_type ?? "")}`)) {
        section.skips.push(`${label} — already recorded`);
        return false;
      }
      section.creates.push(label || `Meeting ${i + 1}`);
      return true;
    });
    if (fresh.length > 0) {
      work.push(async () => {
        const { error } = await supabase.from("consultations").insert(
          fresh.map((c) => {
            const fields = { ...c.fields };
            const next_meeting_date = fields.next_meeting_date;
            delete fields.meeting_date;
            delete fields.next_meeting_date;
            return {
              client_id: clientId,
              ...fields,
              meeting_date: c.meeting_date ?? new Date().toISOString().slice(0, 10),
              next_meeting_date: next_meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(next_meeting_date) ? next_meeting_date : null,
              created_by: userId,
            };
          })
        );
        if (error) throw fail("Meetings & consultations", error.message);
      });
    }
    sections.push(section);
  }

  // --- Actions: update-or-create (Duane's Actions-update spec). Matched by
  // internal id (actions.action_id in the JSON) first, then by title; only
  // the fields the file supplies change; missing field = preserve existing
  // value, never reset; nothing is ever deleted by an import. ---
  const CONFIRM_TITLE = "Confirm outstanding profile details with client";
  type ExistingAction = NonNullable<typeof actions>[number];
  const actionById = new Map((actions ?? []).map((a) => [a.id, a]));
  const findActionByTitle = (title: string): ExistingAction | undefined => {
    const matches = (actions ?? []).filter((a) => lower(a.title) === lower(title));
    return matches.find((a) => a.status !== "completed") ?? matches[0];
  };

  // Owner names resolve to real accounts where possible: an Aligned Media
  // profile or a linked client-team member becomes owner_user_id; anything
  // else stays a free-text owner_name.
  const profileByName = new Map((profilesList ?? []).map((p) => [lower(p.full_name || p.email), p.id]));
  const memberByName = new Map((membersList ?? []).map((m) => [lower(m.name), m]));
  const resolveOwner = (name: string): { owner_user_id: string | null; owner_name: string | null } => {
    const profileId = profileByName.get(lower(name));
    if (profileId) return { owner_user_id: profileId, owner_name: null };
    const member = memberByName.get(lower(name));
    if (member?.user_id) return { owner_user_id: member.user_id, owner_name: null };
    return { owner_user_id: null, owner_name: name };
  };

  const importActions = parsed.actions.filter((a) => lower(a.title) !== lower(CONFIRM_TITLE));
  if (importActions.length > 0) {
    const section: UpdateSection = { label: "Actions", updates: [], creates: [], skips: [] };
    const toCreate: typeof importActions = [];
    for (const a of importActions) {
      const existing = (a.id ? actionById.get(a.id) : undefined) ?? findActionByTitle(a.title);
      if (!existing) {
        if (a.id) {
          // Never guess: an explicit action_id that doesn't belong to this
          // client is flagged, not turned into a new action.
          section.skips.push(`${a.title} — action_id not found for this client, skipped`);
          continue;
        }
        toCreate.push(a);
        section.creates.push(a.title);
        continue;
      }
      const patch: Record<string, unknown> = {};
      const changes: string[] = [];
      if (a.status && a.status !== existing.status) {
        patch.status = a.status;
        patch.completed_at = a.status === "completed" ? new Date().toISOString() : null;
        changes.push(`status: ${existing.status.replace(/_/g, " ")} → ${a.status.replace(/_/g, " ")}`);
      }
      if (a.priority && a.priority !== existing.priority) {
        patch.priority = a.priority;
        changes.push(`priority: ${existing.priority} → ${a.priority}`);
      }
      if (a.due_date && a.due_date !== existing.due_date) {
        patch.due_date = a.due_date;
        changes.push(`due date: ${existing.due_date ?? "(none)"} → ${a.due_date}`);
      }
      if (a.owner_name) {
        const next = resolveOwner(a.owner_name);
        if (next.owner_user_id !== existing.owner_user_id || (next.owner_name ?? "") !== (existing.owner_name ?? "")) {
          patch.owner_user_id = next.owner_user_id;
          patch.owner_name = next.owner_name;
          changes.push(`owner → ${a.owner_name}`);
        }
      }
      if (a.description.trim() && a.description.trim() !== existing.description.trim()) {
        patch.description = a.description;
        changes.push("description");
      }
      if (Object.keys(patch).length === 0) {
        section.skips.push(`${existing.title} — nothing new`);
        continue;
      }
      section.updates.push(`${existing.title} (${changes.join(", ")})`);
      const targetId = existing.id;
      work.push(async () => {
        const { error } = await supabase
          .from("actions")
          .update(patch as Tables["actions"]["Update"])
          .eq("id", targetId);
        if (error) throw fail("Actions", error.message);
      });
    }
    if (toCreate.length > 0) {
      work.push(async () => {
        const rows = toCreate.map((a) => {
          const owner = a.owner_name ? resolveOwner(a.owner_name) : { owner_user_id: userId, owner_name: null };
          return {
            client_id: clientId,
            title: a.title,
            description: a.description,
            due_date: a.due_date,
            ...owner,
            status: a.status ?? "not_started",
            completed_at: a.status === "completed" ? new Date().toISOString() : null,
            priority: a.priority ?? "medium",
            source: "import",
          };
        });
        const { error } = await supabase.from("actions").insert(rows as Tables["actions"]["Insert"][]);
        if (error) throw fail("Actions", error.message);
      });
    }
    sections.push(section);
  }

  // --- The confirmation follow-up (Duane Part H): ONE live parent Action.
  // New unconfirmed fields append to its checklist; fields this update now
  // supplies get their checklist items ticked automatically; when everything
  // is confirmed the parent Action completes itself. ---
  const confirmOpen = (actions ?? []).find((a) => lower(a.title) === lower(CONFIRM_TITLE) && a.status !== "completed");
  const followUp: UpdateSection = { label: "Follow-up", updates: [], creates: [], skips: [] };
  if (confirmOpen) {
    const current = Array.isArray(confirmOpen.checklist)
      ? (confirmOpen.checklist as { text: string; done: boolean }[]).map((c) => ({ text: String(c.text ?? ""), done: c.done === true }))
      : [];
    const resolved = new Set(parsed.resolvedLabels);
    let ticked = 0;
    let nextChecklist = current.map((item) => {
      if (!item.done && resolved.has(item.text)) {
        ticked += 1;
        return { ...item, done: true };
      }
      return item;
    });
    const existingTexts = new Set(nextChecklist.map((c) => c.text));
    const newItems = parsed.needsConfirmation.filter((label) => !existingTexts.has(label));
    if (ticked > 0 || newItems.length > 0) {
      nextChecklist = [...nextChecklist, ...newItems.map((label) => ({ text: label, done: false }))];
      if (ticked > 0) followUp.updates.push(`${ticked} outstanding item(s) now confirmed — ticked off automatically`);
      if (newItems.length > 0) followUp.updates.push(`${newItems.length} new item(s) added to "${CONFIRM_TITLE}"`);
      const allDone = nextChecklist.length > 0 && nextChecklist.every((c) => c.done);
      if (allDone) followUp.updates.push("every item is confirmed — the follow-up action will be marked Completed");
      const confirmId = confirmOpen.id;
      const checklistToSave = nextChecklist;
      work.push(async () => {
        const patch: Record<string, unknown> = { checklist: checklistToSave };
        if (allDone) {
          patch.status = "completed";
          patch.completed_at = new Date().toISOString();
        }
        const { error } = await supabase
          .from("actions")
          .update(patch as Tables["actions"]["Update"])
          .eq("id", confirmId);
        if (error) throw fail("Follow-up", error.message);
      });
    }
  } else if (parsed.needsConfirmation.length > 0) {
    followUp.creates.push(`${CONFIRM_TITLE} (${parsed.needsConfirmation.length} items)`);
    work.push(async () => {
      const { error } = await supabase.from("actions").insert({
        client_id: clientId,
        title: CONFIRM_TITLE,
        description: "Fields this update import couldn't confirm — check them with the client and fill them in.",
        owner_user_id: userId,
        source: "client_confirmation",
        checklist: parsed.needsConfirmation.map((label) => ({ text: label, done: false })),
      });
      if (error) throw fail("Follow-up", error.message);
    });
  }
  if (followUp.updates.length + followUp.creates.length > 0) sections.push(followUp);

  const snapshotKeys = new Set((snapshots ?? []).map((s) => `${lower(s.platform)}|${s.snapshot_date}`));
  if (parsed.metricSnapshots.length > 0) {
    const section: UpdateSection = { label: "Metric snapshots", updates: [], creates: [], skips: [] };
    const fresh = parsed.metricSnapshots.filter((m) => {
      const label = `${m.platform} · ${m.snapshot_date}`;
      if (snapshotKeys.has(`${lower(m.platform)}|${m.snapshot_date}`)) {
        section.skips.push(`${label} — already recorded`);
        return false;
      }
      section.creates.push(label);
      return true;
    });
    if (fresh.length > 0) {
      work.push(async () => {
        const { error } = await supabase.from("metric_snapshots").insert(
          fresh.map((m) => ({ client_id: clientId, platform: m.platform, snapshot_date: m.snapshot_date, followers: m.followers, ...m.extras }))
        );
        if (error) throw fail("Metric snapshots", error.message);
      });
    }
    sections.push(section);
  }

  const targetByPlatform = new Map((targets ?? []).map((t) => [lower(t.platform), t]));
  if (parsed.metricTargets.length > 0) {
    const section: UpdateSection = { label: "Metric targets", updates: [], creates: [], skips: [] };
    for (const target of parsed.metricTargets) {
      const existing = targetByPlatform.get(lower(target.platform));
      if (existing) {
        section.updates.push(target.platform);
        work.push(async () => {
          const patch: Record<string, number | string> = {};
          if (target.baseline_value !== null) patch.baseline_value = target.baseline_value;
          if (target.target_value !== null) patch.target_value = target.target_value;
          if (target.target_date !== null) patch.target_date = target.target_date;
          if (Object.keys(patch).length === 0) return;
          const { error } = await supabase.from("metric_targets").update(patch as Tables["metric_targets"]["Update"]).eq("id", existing.id);
          if (error) throw fail("Metric targets", error.message);
        });
      } else {
        section.creates.push(target.platform);
        work.push(async () => {
          const { error } = await supabase.from("metric_targets").insert({ client_id: clientId, ...target });
          if (error) throw fail("Metric targets", error.message);
        });
      }
    }
    sections.push(section);
  }

  const milestoneKeys = new Set((milestones ?? []).map((m) => `${lower(m.title)}|${m.milestone_date}`));
  if (parsed.milestones.length > 0) {
    const section: UpdateSection = { label: "Timeline milestones", updates: [], creates: [], skips: [] };
    const fresh = parsed.milestones.filter((m) => {
      if (milestoneKeys.has(`${lower(m.title)}|${m.milestone_date}`)) {
        section.skips.push(`${m.title} — already on the timeline`);
        return false;
      }
      section.creates.push(m.title);
      return true;
    });
    if (fresh.length > 0) {
      work.push(async () => {
        const { error } = await supabase.from("milestones").insert(fresh.map((m) => ({ client_id: clientId, ...m })));
        if (error) throw fail("Timeline milestones", error.message);
      });
    }
    sections.push(section);
  }

  return {
    ok: true,
    plan: {
      preview: {
        clientName: client.name,
        nameMismatch:
          parsed.overview.name && lower(parsed.overview.name) !== lower(client.name)
            ? `The import says "${parsed.overview.name}" but this client is "${client.name}" — make sure you're importing into the right profile. The import always applies to THIS client.`
            : null,
        sections,
        needsConfirmation: parsed.needsConfirmation,
        warnings: parsed.warnings,
      },
      apply: async () => {
        for (const job of work) await job();
      },
    },
  };
}

export async function previewClientUpdate(clientId: string, text: string): Promise<ActionResult<ClientUpdatePreview>> {
  return runAction(async () => {
    const supabase = await createClient();
    const built = await buildClientUpdatePlan(supabase, clientId, text, null);
    if (!built.ok) throw new Error(built.message);
    return built.plan.preview;
  });
}

export async function commitClientUpdate(clientId: string, text: string): Promise<ActionResult<ClientUpdatePreview>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const built = await buildClientUpdatePlan(supabase, clientId, text, user?.id ?? null);
    if (!built.ok) throw new Error(built.message);
    await built.plan.apply();
    revalidatePath(`/clients/${clientId}`, "layout");
    revalidatePath("/");
    return built.plan.preview;
  });
}

// ---------------------------------------------------------------------------
// Content Import (§2)
// ---------------------------------------------------------------------------

export interface ContentImportPreview {
  ideas: { title: string; platforms: string[]; flags: string[]; duplicate: boolean }[];
  needsConfirmation: string[];
  warnings: string[];
}

/** Validates against the client's APPROVED strategy: pillar/audience names
 * must already exist (unknowns are flagged, never created), platforms are
 * checked against the client's social strategies, and duplicate titles are
 * flagged and skipped at commit. */
export async function previewContentImport(clientId: string, text: string): Promise<ActionResult<ContentImportPreview>> {
  const result = parseContentImport(text);
  if (!result.ok) return { ok: false, message: result.error };
  const parsed = result.parsed;

  return runAction(async () => {
    const supabase = await createClient();
    const [{ data: pillars }, { data: audiences }, { data: socials }, { data: existing }] = await Promise.all([
      supabase.from("brand_pillars").select("name").eq("client_id", clientId),
      supabase.from("audiences").select("name").eq("client_id", clientId),
      supabase.from("social_strategies").select("platform,account_name").eq("client_id", clientId),
      supabase.from("content_ideas").select("title").eq("client_id", clientId),
    ]);
    const pillarNames = new Set((pillars ?? []).map((p) => p.name.toLowerCase()));
    const audienceNames = new Set((audiences ?? []).map((a) => a.name.toLowerCase()));
    const strategyPlatforms = new Set((socials ?? []).map((s) => s.platform.toLowerCase()));
    const accountNames = new Set((socials ?? []).map((s) => s.account_name.toLowerCase()).filter(Boolean));
    const existingTitles = new Set((existing ?? []).map((c) => c.title.toLowerCase()));

    const ideas = parsed.ideas.map((idea) => {
      const flags: string[] = [];
      if (idea.pillar && !pillarNames.has(idea.pillar.toLowerCase())) {
        flags.push(`Pillar "${idea.pillar}" isn't in this client's approved pillars — it will be left unassigned, not created.`);
      }
      if (idea.audience && !audienceNames.has(idea.audience.toLowerCase())) {
        flags.push(`Audience "${idea.audience}" isn't in this client's audiences — it will be left unassigned, not created.`);
      }
      for (const output of idea.outputs) {
        if (output.account && !accountNames.has(output.account.toLowerCase())) {
          flags.push(`Account "${output.account}" isn't on this client's Social tab — the version will be created without an account link.`);
        }
        if (!output.account && strategyPlatforms.size > 0 && !strategyPlatforms.has(output.platform.toLowerCase())) {
          flags.push(`Platform "${output.platform}" isn't in this client's social strategy — check it's intentional.`);
        }
      }
      return {
        title: idea.title,
        platforms: idea.outputs.map((o) => `${o.platform}${o.format ? ` (${o.format})` : ""}`),
        flags,
        duplicate: existingTitles.has(idea.title.toLowerCase()),
      };
    });

    return { ideas, needsConfirmation: parsed.needsConfirmation, warnings: parsed.warnings };
  });
}

export async function commitContentImport(
  clientId: string,
  text: string
): Promise<ActionResult<{ created: number; skippedDuplicates: string[] }>> {
  const result = parseContentImport(text);
  if (!result.ok) return { ok: false, message: result.error };
  const parsed = result.parsed;

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [{ data: pillars }, { data: audiences }, { data: existing }, { data: socials }] = await Promise.all([
      supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
      supabase.from("audiences").select("id,name").eq("client_id", clientId),
      supabase.from("content_ideas").select("title").eq("client_id", clientId),
      supabase.from("social_strategies").select("id,platform,account_name").eq("client_id", clientId),
    ]);
    const pillarIds = new Map((pillars ?? []).map((p) => [p.name.toLowerCase(), p.id]));
    const audienceIds = new Map((audiences ?? []).map((a) => [a.name.toLowerCase(), a.id]));
    const existingTitles = new Set((existing ?? []).map((c) => c.title.toLowerCase()));
    const accountsByName = new Map(
      (socials ?? []).filter((s) => s.account_name).map((s) => [s.account_name.toLowerCase(), s])
    );

    let created = 0;
    const skippedDuplicates: string[] = [];

    for (const idea of parsed.ideas) {
      if (existingTitles.has(idea.title.toLowerCase())) {
        skippedDuplicates.push(idea.title);
        continue;
      }
      const { data: row, error } = await supabase
        .from("content_ideas")
        .insert({
          client_id: clientId,
          title: idea.title,
          hook: idea.hook,
          body: idea.body,
          notes: idea.notes,
          priority: idea.priority,
          production_due_date: idea.production_due_date,
          target_publish_date: idea.target_publish_date,
          pillar_id: idea.pillar ? (pillarIds.get(idea.pillar.toLowerCase()) ?? null) : null,
          audience_id: idea.audience ? (audienceIds.get(idea.audience.toLowerCase()) ?? null) : null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(`"${idea.title}": ${error.message}`);

      if (idea.outputs.length > 0) {
        const { error: outputError } = await supabase.from("content_outputs").insert(
          idea.outputs.map((output, i) => {
            // Match the named publishing account from the Social tab; the
            // matched account also wins on the platform label.
            const account = output.account ? accountsByName.get(output.account.toLowerCase()) : undefined;
            return {
              content_id: row.id,
              client_id: clientId,
              platform: account?.platform ?? output.platform,
              social_account_id: account?.id ?? null,
              format: output.format,
              caption: output.caption,
              cta: output.cta,
              hashtags: output.hashtags,
              alt_text: output.alt_text,
              destination_link: output.destination_link,
              notes: output.notes,
              sort_order: i,
            };
          })
        );
        if (outputError) {
          // Remove the half-made master so a retry doesn't hit the
          // duplicate-title skip.
          await supabase.from("content_ideas").delete().eq("id", row.id);
          throw new Error(`"${idea.title}" platform versions: ${outputError.message}`);
        }
      }
      created += 1;
    }

    revalidatePath(`/clients/${clientId}/content`);
    revalidatePath("/");
    return { created, skippedDuplicates };
  });
}
