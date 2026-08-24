import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ClientUpdateForm } from "@/components/import/ClientUpdateForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { CLIENT_PROFILE_TEMPLATE } from "@/lib/import/templates";

export const metadata = { title: "Update via import" };

export default async function ClientUpdateImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: openActions }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("actions")
      .select("id,title,status")
      .eq("client_id", id)
      .neq("status", "completed")
      .order("created_at"),
  ]);
  if (!client) notFound();

  // Bake the client's live open actions (with their internal ids) into the
  // template so the AI can update them safely by action_id instead of
  // relying on exact title matches (Duane's Action-ID ask).
  const actionsBlock =
    (openActions ?? []).length > 0
      ? `\nThis client's OPEN actions right now (use action_id to update one):\n${(openActions ?? [])
          .map((a) => `- action_id "${a.id}" — "${a.title}" (currently ${a.status.replace(/_/g, " ")})`)
          .join("\n")}\n`
      : "";

  const template = CLIENT_PROFILE_TEMPLATE.replace(
    "RULES — follow these exactly:",
    `THIS IS AN UPDATE for the existing client "${client.name}" — include ONLY the sections and fields that are new or have changed since the last import. Omit everything that hasn't changed. Repeatable records (audiences, pillars, meetings, actions…) are matched by name/date: matching records are updated, new ones are added, and nothing is ever deleted. For actions, a partial record like {"action_id": "…", "status": "Completed"} is enough — omitted fields keep their current values.
${actionsBlock}
RULES — follow these exactly:`
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Update {client.name} via import</h1>
        <p className="text-sm text-ink-soft">
          For follow-up consultations, strategy reviews and smaller updates. Same format as the onboarding import — the AI
          includes only what changed. The update applies to <span className="font-medium text-ink">this client</span> (matched
          by internal ID, never by name), you review a field-by-field preview of what&rsquo;s new or changing before anything is
          written, existing information is left untouched where nothing changed, and every applied change lands in the
          client&rsquo;s history.
        </p>
      </div>

      <TemplateBox template={template} label={`AI instruction template (update ${client.name})`} />
      <ClientUpdateForm clientId={id} />
    </div>
  );
}
