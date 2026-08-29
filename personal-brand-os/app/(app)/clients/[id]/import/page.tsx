import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ClientUpdateForm } from "@/components/import/ClientUpdateForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { CLIENT_PROFILE_TEMPLATE } from "@/lib/import/templates";
import { socialAccountLabel } from "@/lib/format";

export const metadata = { title: "Update via import" };

export default async function ClientUpdateImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: client },
    { data: openActions },
    { data: pillars },
    { data: audiences },
    { data: socials },
    { data: authority },
  ] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase.from("actions").select("id,title,status").eq("client_id", id).neq("status", "completed").order("created_at"),
    supabase.from("brand_pillars").select("id,name").eq("client_id", id).order("sort_order"),
    supabase.from("audiences").select("id,name").eq("client_id", id).order("sort_order"),
    supabase.from("social_strategies").select("id,platform,account_name").eq("client_id", id).order("sort_order"),
    supabase.from("authority_opportunities").select("id,type,host,status").eq("client_id", id).order("created_at"),
  ]);
  if (!client) notFound();

  // Bake the client's live records — with their internal ids — into the
  // template. This is what makes an update a real update: the AI echoes the
  // id back, so renaming a pillar edits it instead of creating a second one
  // (Duane's duplicate-pillar report).
  const idList = (title: string, rows: { id: string; label: string }[]) =>
    rows.length > 0 ? `\n${title}:\n${rows.map((r) => `- id "${r.id}" — ${r.label}`).join("\n")}\n` : "";

  const recordsBlock =
    idList(
      "This client's CONTENT PILLARS right now",
      (pillars ?? []).map((p) => ({ id: p.id, label: `"${p.name}"` }))
    ) +
    idList(
      "This client's AUDIENCES right now",
      (audiences ?? []).map((a) => ({ id: a.id, label: `"${a.name}"` }))
    ) +
    idList(
      "This client's SOCIAL ACCOUNTS right now",
      (socials ?? []).map((s) => ({ id: s.id, label: `"${socialAccountLabel(s.platform, s.account_name)}"` }))
    ) +
    idList(
      "This client's AUTHORITY OPPORTUNITIES right now",
      (authority ?? []).map((a) => ({
        id: a.id,
        label: `"${a.type}${a.host ? ` · ${a.host}` : ""}" (currently ${a.status.replace(/_/g, " ")})`,
      }))
    ) +
    idList(
      "This client's OPEN ACTIONS right now",
      (openActions ?? []).map((a) => ({ id: a.id, label: `"${a.title}" (currently ${a.status.replace(/_/g, " ")})` }))
    );

  const template = CLIENT_PROFILE_TEMPLATE.replace(
    "RULES — follow these exactly:",
    `THIS IS AN UPDATE for the existing client "${client.name}" — include ONLY the sections and fields that are new or have changed. Omit everything unchanged; omitted sections are left completely untouched.

CRITICAL — USE THE IDs BELOW. Every existing record is listed with its permanent PBOS id. When you are updating one of these records, include its "id" exactly as shown. PBOS then updates that record even if its name has changed. If you leave the id out, PBOS falls back to matching on the name (ignoring numbering, arrows and punctuation) and creates a new record only when it genuinely can't find a match. Never invent an id, and never reuse one record's id for a different record.
${recordsBlock}
By default a repeatable section is an UPDATE: matching records are updated and only genuinely new ones are added. If you need different behaviour for a whole section, wrap it:
  "content_pillars": { "mode": "replace", "items": [ ... ] }   ← the list is definitive; anything not listed is offered for removal
  "content_pillars": { "mode": "append",  "items": [ ... ] }   ← these are all brand new records
  "content_pillars": [ ... ]                                    ← the default, same as "upsert"

RULES — follow these exactly:`
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Update {client.name} via import</h1>
        <p className="text-sm text-ink-soft">
          For follow-up consultations, strategy reviews and smaller updates. The template below already contains this
          client&rsquo;s existing records and their internal IDs, so the AI can update them by ID rather than by name — renaming a
          pillar edits it instead of creating a second one. You see a full{" "}
          <span className="font-medium text-ink">updated / created / removed</span> count before anything is written, sections
          you don&rsquo;t include are left completely untouched, and nothing is ever deleted without an explicit tick.
        </p>
      </div>

      <TemplateBox template={template} label={`AI instruction template (update ${client.name})`} />
      <ClientUpdateForm clientId={id} />
    </div>
  );
}
