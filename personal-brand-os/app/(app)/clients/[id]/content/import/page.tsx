import { createClient } from "@/lib/supabase/server";
import { ContentImportForm } from "@/components/import/ContentImportForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { CONTENT_IMPORT_TEMPLATE } from "@/lib/import/templates";
import { buildPlatformPrompt, cadenceLabel, crossPostRuleMeta } from "@/lib/platform-strategy";
import { socialAccountLabel } from "@/lib/format";

export const metadata = { title: "Import content" };

export default async function ContentImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: pillars }, { data: audiences }, { data: socials }] = await Promise.all([
    supabase.from("brand_pillars").select("name").eq("client_id", id).order("sort_order"),
    supabase.from("audiences").select("name").eq("client_id", id).order("sort_order"),
    supabase.from("social_strategies").select("*").eq("client_id", id).neq("account_status", "inactive").order("sort_order"),
  ]);

  // Bake the client's approved strategy into the template so the AI has the
  // real names to match against instead of inventing its own — and, since
  // Duane's Platform Strategy brief, each account's actual rules, so the AI
  // proposes a platform mix rather than assuming every idea goes everywhere.
  const accountBlock = (socials ?? [])
    .map((account) => {
      const rule = crossPostRuleMeta(account.cross_post_rule);
      const detail = buildPlatformPrompt(account)
        .split("\n")
        .slice(1)
        .map((line) => `    ${line}`)
        .join("\n");
      return [
        `- ${socialAccountLabel(account.platform, account.account_name)} — ${rule.short.toUpperCase()}: ${rule.hint}`,
        `    Target cadence: ${cadenceLabel(account)}`,
        detail,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const strategyBlock = [
    "",
    "This client's APPROVED strategy — use these exact names:",
    `Pillars: ${(pillars ?? []).map((p) => p.name).join("; ") || "none yet"}`,
    `Audiences: ${(audiences ?? []).map((a) => a.name).join("; ") || "none yet"}`,
    "",
    "PLATFORM STRATEGY — read this before choosing platforms for any idea.",
    "A master idea does NOT belong on every platform. For each idea, decide which of these accounts it genuinely",
    "suits, and create an output only for those. Write each output in that platform's own voice, format and length —",
    "never paste the same caption across accounts. Put the account's full name in outputs.account.",
    "Accounts marked NEVER must not receive outputs from a shared idea. Accounts marked SELECTIVE should only be",
    "used when the idea is a genuinely strong fit; PBOS will ask before creating those.",
    "",
    accountBlock || "No publishing accounts set up yet.",
    "",
  ].join("\n");
  const template = CONTENT_IMPORT_TEMPLATE.replace("Here is the content to convert:", `${strategyBlock}\nHere is the content to convert:`);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Import content</h1>
        <p className="text-sm text-ink-soft">
          Idea → AI drafting → structured import → review → pipeline. One master idea per concept, with the platform
          versions underneath it. The template carries each account&rsquo;s platform strategy, so the AI proposes a platform mix
          rather than assuming every idea belongs everywhere — and you see that mix, with the reason for each decision, before
          anything is created. Pillars, audiences and accounts are matched against this client&rsquo;s approved strategy: anything
          unknown is flagged, never created, and duplicate titles are skipped.
        </p>
      </div>

      <TemplateBox template={template} label="AI instruction template (content) — includes this client's approved strategy" />
      <ContentImportForm clientId={id} />
    </div>
  );
}
