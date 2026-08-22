import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { StrategySnapshot, SnapshotField } from "@/lib/signoff-snapshot";

type Client = SupabaseServerClient;

function present(fields: [string, string | null | undefined][]): SnapshotField[] {
  return fields
    .filter(([, value]) => (value ?? "").trim())
    .map(([label, value]) => ({ label, value: (value ?? "").trim() }));
}

/** Capture the current agreed strategy for a client as a frozen snapshot.
 * Runs on the caller's RLS-scoped client — only someone with strategic
 * access can see enough to build one, which matches who is allowed to
 * create packs. */
export async function buildStrategySnapshot(supabase: Client, clientId: string): Promise<StrategySnapshot | null> {
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const [{ data: vision }, { data: positioning }, { data: audiences }, { data: pillars }, { data: sales }, { data: socials }, { data: actions }] =
    await Promise.all([
      supabase.from("brand_vision").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("positioning").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("audiences").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("brand_pillars").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase.from("sales_strategy").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("social_strategies").select("*").eq("client_id", clientId).order("sort_order").order("created_at"),
      supabase
        .from("actions")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(12),
    ]);

  return {
    clientName: client.name,
    northStar: client.north_star.trim(),
    vision: present([
      ["Long-term goal", vision?.long_term_goal],
      ["Desired positioning", vision?.desired_positioning],
      ["Commercial goal", vision?.commercial_goal],
      ["Impact goal", vision?.impact_goal],
      ["Legacy / contribution", vision?.legacy_contribution],
    ]),
    positioning: present([
      ["Positioning statement", positioning?.positioning_statement],
      ["Expertise", positioning?.expertise],
      ["Differentiators", positioning?.differentiators],
      ["Unique story", positioning?.unique_story],
      ["Core beliefs", positioning?.core_beliefs],
    ]),
    authorityPosition: (vision?.authority_goal ?? "").trim(),
    audiences: (audiences ?? []).map((a) => ({ name: a.name, description: a.description.trim() })),
    pillars: (pillars ?? []).map((p) => ({
      name: p.name,
      description: p.description.trim(),
      keyMessages: p.key_messages.trim(),
    })),
    coreMessages: (sales?.sales_messaging ?? "").trim(),
    commercialObjectives: present([
      ["Services / products", sales?.services_products],
      ["Ideal clients", sales?.ideal_clients],
      ["Offers", sales?.offers],
      ["Calls to action", sales?.calls_to_action],
    ]),
    platforms: (socials ?? []).map((s) => ({
      platform: s.account_name ? `${s.platform} — ${s.account_name}` : s.platform,
      objective: s.objective.trim(),
      postingFrequency: s.posting_frequency.trim(),
    })),
    priorities: (actions ?? []).map((a) => ({ title: a.title, dueDate: a.due_date })),
    generatedAt: new Date().toISOString(),
  };
}
