import { createClient } from "@/lib/supabase/server";
import { ContentImportForm } from "@/components/import/ContentImportForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { CONTENT_IMPORT_TEMPLATE } from "@/lib/import/templates";

export const metadata = { title: "Import content" };

export default async function ContentImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
    supabase.from("brand_pillars").select("name").eq("client_id", id).order("sort_order"),
    supabase.from("audiences").select("name").eq("client_id", id).order("sort_order"),
    supabase.from("social_strategies").select("platform,account_name").eq("client_id", id).order("sort_order"),
  ]);

  // Bake the client's approved strategy into the template so the AI has the
  // real names to match against instead of inventing its own.
  const strategyBlock = [
    "",
    "This client's APPROVED strategy — use these exact names:",
    `Pillars: ${(pillars ?? []).map((p) => p.name).join("; ") || "none yet"}`,
    `Audiences: ${(audiences ?? []).map((a) => a.name).join("; ") || "none yet"}`,
    `Publishing accounts (use the account name in outputs.account): ${
      (socials ?? [])
        .map((s) => (s.account_name ? `${s.platform} — ${s.account_name}` : s.platform))
        .join("; ") || "none yet"
    }`,
    "",
  ].join("\n");
  const template = CONTENT_IMPORT_TEMPLATE.replace("Here is the content to convert:", `${strategyBlock}\nHere is the content to convert:`);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Import content</h1>
        <p className="text-sm text-ink-soft">
          Idea → AI drafting → structured import → review → pipeline. One master idea per concept, with the platform
          versions underneath it. Pillars, audiences and platforms are matched against this client&rsquo;s approved strategy —
          anything unknown is flagged, never created; duplicate titles are flagged and skipped.
        </p>
      </div>

      <TemplateBox template={template} label="AI instruction template (content) — includes this client's approved strategy" />
      <ContentImportForm clientId={id} />
    </div>
  );
}
