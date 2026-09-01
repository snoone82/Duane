import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StrategyImportForm } from "@/components/import/StrategyImportForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { PLATFORM_STRATEGY_TEMPLATE } from "@/lib/import/templates";

export const metadata = { title: "Import platform strategy" };

export default async function StrategyImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client }, { data: accounts }, { data: audiences }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("social_strategies")
      .select("id,platform,account_name,account_status")
      .eq("client_id", id)
      .order("sort_order"),
    supabase.from("audiences").select("name").eq("client_id", id).order("sort_order"),
  ]);
  if (!client) notFound();

  // The AI is given this client's real accounts with their ids, so each entry
  // lands on the right existing account rather than being matched by a name
  // that might have been written differently in the consultation.
  const accountBlock = (accounts ?? []).length
    ? (accounts ?? [])
        .map(
          (a) =>
            `- account_id "${a.id}" — platform "${a.platform}", account_name "${a.account_name}"${
              a.account_status !== "active" ? ` (${a.account_status})` : ""
            }`
        )
        .join("\n")
    : "None set up yet — add this client's social accounts before importing a strategy.";

  const audienceBlock = (audiences ?? []).length
    ? (audiences ?? []).map((a) => a.name).join("; ")
    : "none recorded yet";

  const template = PLATFORM_STRATEGY_TEMPLATE.replace(
    "Here are the consultation notes to convert:",
    `This client's EXISTING social accounts — use these exact ids and names:
${accountBlock}

This client's AUDIENCES (primary_audience / secondary_audience must match one of these exactly):
${audienceBlock}

Here are the consultation notes to convert:`
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Import platform strategy for {client.name}</h1>
        <p className="text-sm text-ink-soft">
          Consultation → AI structures the strategy → import here → the content importer and AI generation read those rules
          when creating and adapting content. One file covers every platform, and they&rsquo;re all applied in one go. Existing
          accounts are updated, never duplicated: matching runs account ID, then account name, then platform, and anything
          PBOS can&rsquo;t place confidently is handed back for you to assign. You see every field as{" "}
          <span className="font-medium text-ink">current → imported</span> before anything is written, and a blank in the file
          never wipes what&rsquo;s already there.
        </p>
      </div>

      <TemplateBox
        template={template}
        label={`AI instruction template (platform strategy — ${client.name})`}
      />
      <StrategyImportForm clientId={id} />
    </div>
  );
}
