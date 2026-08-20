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
        linkedin_url: parsed.overview.linkedin_url,
        instagram_url: parsed.overview.instagram_url,
        twitter_url: parsed.overview.twitter_url,
        youtube_url: parsed.overview.youtube_url,
        tiktok_url: parsed.overview.tiktok_url,
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

      const actionRows = parsed.actions.map((a) => ({
        client_id: clientId,
        title: a.title,
        description: a.description,
        due_date: a.due_date,
        owner_name: a.owner_name,
        owner_user_id: a.owner_name ? null : (user?.id ?? null),
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
          // @ts-expect-error checklist is jsonb; the insert type widens fine at runtime
          checklist: parsed.needsConfirmation.map((label) => ({ text: label, done: false })),
        });
      }
      if (actionRows.length > 0) {
        await step(
          "Actions",
          async () => {
            const { error } = await supabase.from("actions").insert(actionRows);
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
      supabase.from("social_strategies").select("platform").eq("client_id", clientId),
      supabase.from("content_ideas").select("title").eq("client_id", clientId),
    ]);
    const pillarNames = new Set((pillars ?? []).map((p) => p.name.toLowerCase()));
    const audienceNames = new Set((audiences ?? []).map((a) => a.name.toLowerCase()));
    const strategyPlatforms = new Set((socials ?? []).map((s) => s.platform.toLowerCase()));
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
        if (strategyPlatforms.size > 0 && !strategyPlatforms.has(output.platform.toLowerCase())) {
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

    const [{ data: pillars }, { data: audiences }, { data: existing }] = await Promise.all([
      supabase.from("brand_pillars").select("id,name").eq("client_id", clientId),
      supabase.from("audiences").select("id,name").eq("client_id", clientId),
      supabase.from("content_ideas").select("title").eq("client_id", clientId),
    ]);
    const pillarIds = new Map((pillars ?? []).map((p) => [p.name.toLowerCase(), p.id]));
    const audienceIds = new Map((audiences ?? []).map((a) => [a.name.toLowerCase(), a.id]));
    const existingTitles = new Set((existing ?? []).map((c) => c.title.toLowerCase()));

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
          idea.outputs.map((output, i) => ({
            content_id: row.id,
            client_id: clientId,
            platform: output.platform,
            format: output.format,
            caption: output.caption,
            cta: output.cta,
            hashtags: output.hashtags,
            alt_text: output.alt_text,
            destination_link: output.destination_link,
            notes: output.notes,
            sort_order: i,
          }))
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
