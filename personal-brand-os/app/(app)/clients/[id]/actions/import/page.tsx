import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ClientUpdateForm } from "@/components/import/ClientUpdateForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { ACTIONS_IMPORT_TEMPLATE } from "@/lib/import/templates";

export const metadata = { title: "Import actions" };

/** Duane's Action Importer, living where he expects it: on the Actions
 * tab. Same engine as the update importer, scoped to actions — paste an
 * AI-structured action plan, review, and the actions + checklists are
 * created (or existing ones updated, matched by action_id / exact title). */
export default async function ActionsImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: openActions }, { data: team }, { data: members }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase.from("actions").select("id,title,status").eq("client_id", id).neq("status", "completed").order("created_at"),
    supabase.from("profiles").select("full_name,email,role").in("role", ["admin", "member", "contractor"]),
    supabase.from("client_members").select("name").eq("client_id", id).neq("status", "disabled"),
  ]);
  if (!client) notFound();

  const ownerNames = [
    ...(team ?? []).map((p) => p.full_name || p.email),
    ...(members ?? []).map((m) => m.name),
  ].filter(Boolean);

  const contextBlock = [
    "",
    `Client: ${client.name}`,
    `Assignable owners (use these exact names): ${ownerNames.join("; ") || "none"}`,
    (openActions ?? []).length > 0
      ? `OPEN actions right now (use action_id to update one):\n${(openActions ?? [])
          .map((a) => `- action_id "${a.id}" — "${a.title}" (currently ${a.status.replace(/_/g, " ")})`)
          .join("\n")}`
      : "This client has no open actions yet — everything you output will be created new.",
    "",
  ].join("\n");
  const template = ACTIONS_IMPORT_TEMPLATE.replace(
    "Here is the action plan to convert:",
    `${contextBlock}\nHere is the action plan to convert:`
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Import actions — {client.name}</h1>
        <p className="text-sm text-ink-soft">
          Turn a consultation output, strategy session or AI-generated action plan straight into operational tasks.
          One action per phase or task, with its subtasks as a checklist. Existing actions are matched by ID or exact
          title and updated — only the fields you supply change, and nothing is ever deleted. You review every change
          before anything is written.
        </p>
      </div>

      <TemplateBox template={template} label={`AI instruction template (actions for ${client.name})`} />
      <ClientUpdateForm clientId={id} />
    </div>
  );
}
