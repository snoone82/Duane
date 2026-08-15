import type { SupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

type Client = SupabaseServerClient;

function section(title: string, body: string): string {
  const text = body.trim();
  if (!text) return "";
  return `## ${title}\n${text}\n`;
}

function fields(pairs: [string, string | null | undefined][]): string {
  return pairs
    .filter(([, v]) => (v ?? "").trim())
    .map(([k, v]) => `${k}: ${(v ?? "").trim()}`)
    .join("\n");
}

/**
 * Everything the assistant is allowed to know about one client, rendered as
 * markdown. Every query runs through the signed-in user's RLS-scoped client,
 * so a contractor's assistant simply never sees the strategic tables — the
 * grounding is exactly the user's own view of the database, never more.
 */
export async function buildClientContext(supabase: Client, clientId: string): Promise<string | null> {
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client) return null;

  const [
    { data: vision },
    { data: positioning },
    { data: pillars },
    { data: audiences },
    { data: socials },
    { data: sales },
    { data: consultations },
    { data: actions },
    { data: snapshots },
    { data: ideas },
    { data: opportunities },
  ] = await Promise.all([
    supabase.from("brand_vision").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("positioning").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("brand_pillars").select("*").eq("client_id", clientId).order("sort_order"),
    supabase.from("audiences").select("*").eq("client_id", clientId).order("sort_order"),
    supabase.from("social_strategies").select("*").eq("client_id", clientId).order("sort_order"),
    supabase.from("sales_strategy").select("*").eq("client_id", clientId).maybeSingle(),
    supabase.from("consultations").select("*").eq("client_id", clientId).order("meeting_date", { ascending: false }).limit(5),
    supabase.from("actions").select("*").eq("client_id", clientId).neq("status", "completed").order("due_date", { ascending: true, nullsFirst: false }).limit(20),
    supabase.from("metric_snapshots").select("*").eq("client_id", clientId).order("snapshot_date", { ascending: false }).limit(12),
    supabase.from("content_ideas").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(25),
    supabase.from("authority_opportunities").select("*").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(15),
  ]);

  const parts: string[] = [];

  parts.push(
    section(
      "Client",
      fields([
        ["Name", client.name],
        ["North Star", client.north_star],
        ["Company", client.company],
        ["Role", client.job_title],
        ["Industry", client.industry],
        ["Location", client.location],
        ["Status", client.status],
        ["Notes", client.notes],
      ])
    )
  );

  if (vision) {
    parts.push(
      section(
        "Brand vision",
        fields([
          ["Long-term goal", vision.long_term_goal],
          ["Desired positioning", vision.desired_positioning],
          ["Authority goal", vision.authority_goal],
          ["Commercial goal", vision.commercial_goal],
          ["Impact goal", vision.impact_goal],
          ["Legacy", vision.legacy_contribution],
        ])
      )
    );
  }

  if (positioning) {
    parts.push(
      section(
        "Positioning",
        fields([
          ["Statement", positioning.positioning_statement],
          ["Expertise", positioning.expertise],
          ["Differentiators", positioning.differentiators],
          ["Unique story", positioning.unique_story],
          ["Core beliefs", positioning.core_beliefs],
          ["Contrarian opinions", positioning.contrarian_opinions],
        ])
      )
    );
  }

  if (pillars?.length) {
    parts.push(
      section(
        "Content pillars",
        pillars
          .map((p) => `- ${p.name}: ${p.description || p.purpose}${p.example_topics ? ` (example topics: ${p.example_topics})` : ""}`)
          .join("\n")
      )
    );
  }

  if (audiences?.length) {
    parts.push(
      section(
        "Audiences",
        audiences
          .map((a) => `- ${a.name}: ${a.description}${a.pain_points ? ` Pain points: ${a.pain_points}.` : ""}${a.goals ? ` Goals: ${a.goals}.` : ""}`)
          .join("\n")
      )
    );
  }

  if (socials?.length) {
    parts.push(
      section(
        "Per-platform social strategy",
        socials
          .map(
            (s) =>
              `- ${s.platform}: objective ${s.objective || "unset"}; content types ${s.content_types || "unset"}; cadence ${s.posting_frequency || "unset"}${s.cta_strategy ? `; CTA ${s.cta_strategy}` : ""}`
          )
          .join("\n")
      )
    );
  }

  if (sales) {
    parts.push(
      section(
        "Sales strategy",
        fields([
          ["Services/products", sales.services_products],
          ["Target customers", sales.target_customers],
          ["Ideal clients", sales.ideal_clients],
          ["Offers", sales.offers],
          ["Sales messaging", sales.sales_messaging],
          ["Lead generation", sales.lead_generation_approach],
          ["Calls to action", sales.calls_to_action],
          ["Lead magnets", sales.lead_magnets],
        ])
      )
    );
  }

  if (consultations?.length) {
    parts.push(
      section(
        "Recent meetings (newest first)",
        consultations
          .map(
            (c) =>
              `- ${formatDate(c.meeting_date)}${c.meeting_type ? ` (${c.meeting_type})` : ""}: ${c.summary || "no summary"}${c.challenges ? ` Challenges: ${c.challenges}.` : ""}${c.wins ? ` Wins: ${c.wins}.` : ""}${c.next_meeting_date ? ` Next meeting: ${formatDate(c.next_meeting_date)}.` : ""}`
          )
          .join("\n")
      )
    );
  }

  if (actions?.length) {
    parts.push(
      section(
        "Open actions",
        actions
          .map((a) => `- [${a.status}] ${a.title}${a.due_date ? ` (due ${formatDate(a.due_date)})` : ""}${a.owner_name ? ` — ${a.owner_name}` : ""}`)
          .join("\n")
      )
    );
  }

  if (snapshots?.length) {
    parts.push(
      section(
        "Latest social metrics (newest first)",
        snapshots
          .map((s) => `- ${s.platform} @ ${formatDate(s.snapshot_date)}: ${s.followers} followers${s.engagement != null ? `, engagement ${s.engagement}` : ""}${s.reach != null ? `, reach ${s.reach}` : ""}`)
          .join("\n")
      )
    );
  }

  if (ideas?.length) {
    parts.push(
      section(
        "Content pipeline (most recently touched)",
        ideas.map((i) => `- [${i.status}] ${i.title}${i.platform ? ` (${i.platform})` : ""}`).join("\n")
      )
    );
  }

  if (opportunities?.length) {
    parts.push(
      section(
        "Authority pipeline (podcasts, speaking, press)",
        opportunities.map((o) => `- [${o.status}] ${o.type}${o.host ? ` with ${o.host}` : ""}`).join("\n")
      )
    );
  }

  return parts.filter(Boolean).join("\n");
}
