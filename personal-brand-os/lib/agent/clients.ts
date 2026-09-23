import "server-only";
import { AgentAuthError, type AgentIdentity, scopedClientIds } from "@/lib/agent/auth";

/**
 * The client read layer, as the Command Centre sees it.
 *
 * Duane: "ChatGPT should pull the current approved information from PBOS when
 * answering rather than relying on ChatGPT memory or information being
 * manually pasted into the conversation."
 *
 * So every shape here carries `updated_at` where PBOS holds one. That is the
 * point rather than a detail: an agent that cannot tell how old a positioning
 * statement is will quote a stale one with total confidence, which is exactly
 * the failure this is meant to end.
 *
 * Reads only. Writes stay deliberate and separate, as he asked — generated
 * content must not be able to quietly rewrite a client's positioning.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the service client's generics don't survive being passed around
type Db = any;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClientMatch {
  id: string;
  name: string;
  company: string | null;
  status: string;
}

/**
 * Find clients by name. Deliberately returns a LIST — Duane: "If there is
 * genuine ambiguity, return the possible matches rather than guessing."
 */
export async function searchClients(db: Db, identity: AgentIdentity, query: string): Promise<ClientMatch[]> {
  let q = db.from("clients").select("id,name,company,status").order("name");
  const allowed = scopedClientIds(identity);
  if (allowed) q = q.in("id", allowed);
  const term = query.trim();
  if (term) q = q.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw new AgentAuthError(500, "query_failed", "PBOS couldn't complete that request.", error.message);
  return data ?? [];
}

/**
 * Resolve whatever the agent was given to exactly one client, or refuse.
 *
 * The canonical id always wins. A name is matched exactly first, then by
 * containment — and two matches is a 409 carrying both, never a coin toss.
 * This is the rule that stops "Daniel" quietly becoming the wrong Daniel.
 */
export async function resolveClientRef(db: Db, identity: AgentIdentity, raw: string): Promise<ClientMatch> {
  const value = (raw ?? "").trim();
  if (!value) throw new AgentAuthError(400, "client_required", "Say which client.");

  if (UUID_RE.test(value)) {
    const { data } = await db.from("clients").select("id,name,company,status").eq("id", value).maybeSingle();
    if (!data) throw new AgentAuthError(404, "client_not_found", `No client with id ${value}.`);
    const allowed = scopedClientIds(identity);
    if (allowed && !allowed.includes(data.id)) {
      throw new AgentAuthError(403, "client_out_of_scope", "This token isn't scoped to that client.");
    }
    return data;
  }

  const all = await searchClients(db, identity, "");
  const lower = value.toLowerCase();
  const exact = all.filter((c) => c.name.toLowerCase() === lower);
  const matches =
    exact.length > 0
      ? exact
      : all.filter((c) => c.name.toLowerCase().includes(lower) || (c.company ?? "").toLowerCase().includes(lower));

  if (matches.length === 0) throw new AgentAuthError(404, "client_not_found", `No client matching "${value}".`);
  if (matches.length > 1) {
    throw new AgentAuthError(
      409,
      "client_ambiguous",
      `"${value}" matches ${matches.length} clients: ${matches.map((c) => `${c.name} (${c.id})`).join("; ")}. Ask which one, then use the id.`
    );
  }
  return matches[0]!;
}

/** Priority 1 — who this client is and what they are for commercially. */
export async function getClientOverview(db: Db, clientId: string) {
  const { data, error } = await db
    .from("clients")
    .select(
      "id,name,company,job_title,industry,status,package,tier,location,website_url,north_star,flagship_offer,commercial_priority,brand_role,retainer_amount,notes,updated_at"
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new AgentAuthError(500, "query_failed", "PBOS couldn't complete that request.", error.message);
  if (!data) throw new AgentAuthError(404, "client_not_found", "No such client.");
  return {
    client_id: data.id,
    name: data.name,
    company: data.company,
    job_title: data.job_title,
    industry: data.industry,
    status: data.status,
    package: data.package,
    tier: data.tier,
    location: data.location,
    website_url: data.website_url,
    north_star_service: data.north_star,
    flagship_offer: data.flagship_offer,
    commercial_priority: data.commercial_priority,
    brand_role: data.brand_role,
    retainer_amount: data.retainer_amount,
    notes: data.notes,
    updated_at: data.updated_at,
  };
}

/** Priority 1 — positioning and the long-term vision, in one answer. */
export async function getClientProfile(db: Db, clientId: string) {
  const [{ data: positioning }, { data: vision }] = await Promise.all([
    db
      .from("positioning")
      .select(
        "positioning_statement,current_positioning,desired_positioning,differentiators,unique_story,expertise,core_beliefs,contrarian_opinions,updated_at"
      )
      .eq("client_id", clientId)
      .maybeSingle(),
    db
      .from("brand_vision")
      .select("long_term_goal,desired_positioning,authority_goal,commercial_goal,impact_goal,legacy_contribution,updated_at")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  return {
    client_id: clientId,
    positioning: positioning
      ? {
          positioning_statement: positioning.positioning_statement,
          current_positioning: positioning.current_positioning,
          desired_positioning: positioning.desired_positioning,
          differentiators: positioning.differentiators,
          unique_story: positioning.unique_story,
          expertise: positioning.expertise,
          core_beliefs: positioning.core_beliefs,
          contrarian_opinions: positioning.contrarian_opinions,
          updated_at: positioning.updated_at,
        }
      : null,
    // Two "desired positioning" fields exist and they are not duplicates:
    // positioning.desired_positioning is the near-term shift, vision's is
    // where the brand is ultimately going. Both are surfaced rather than
    // one silently winning.
    vision: vision
      ? {
          long_term_goal: vision.long_term_goal,
          vision_positioning: vision.desired_positioning,
          authority_goal: vision.authority_goal,
          commercial_goal: vision.commercial_goal,
          impact_goal: vision.impact_goal,
          legacy_contribution: vision.legacy_contribution,
          updated_at: vision.updated_at,
        }
      : null,
  };
}

/** Priority 2 — everything that governs what may be written. */
export async function getClientContentStrategy(db: Db, clientId: string) {
  const [{ data: audiences }, { data: pillars }, { data: guidelines }] = await Promise.all([
    db
      .from("audiences")
      .select(
        "id,name,description,demographics,pain_points,goals,where_they_are,content_interests,target_belief,target_action,stage,eligible_for_generation,updated_at"
      )
      .eq("client_id", clientId)
      .order("sort_order"),
    db
      .from("brand_pillars")
      .select(
        "id,name,description,purpose,target_audience,key_messages,example_topics,associated_stories,relevant_expertise,calls_to_action,updated_at"
      )
      .eq("client_id", clientId)
      .order("sort_order"),
    db
      .from("content_guidelines")
      .select(
        "secondary_objectives,tone_voice_notes,preferred_language,avoid_language,cta_priorities,primary_cta_destination,content_safeguards,updated_at"
      )
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  return {
    client_id: clientId,
    audiences: audiences ?? [],
    content_pillars: pillars ?? [],
    guidelines: guidelines ?? null,
  };
}

/** Priority 3 — the accounts, their live bios, and how often to post. */
export async function getClientSocialProfiles(db: Db, clientId: string) {
  const { data, error } = await db
    .from("social_strategies")
    .select(
      "id,platform,account_name,owner_brand,url,bio,bio_updated_at,account_type,account_status,is_primary,publishing_enabled,platform_role,cadence_target,cadence_period,preferred_formats,content_length,tone_voice,hook_guidance,commercial_ratio,platform_exclusions,objective,audience,updated_at"
    )
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("sort_order");
  if (error) throw new AgentAuthError(500, "query_failed", "PBOS couldn't complete that request.", error.message);

  return {
    client_id: clientId,
    accounts: (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      // Say so explicitly rather than returning "" and letting the agent
      // decide whether an empty string means "no bio" or "not recorded".
      bio: (row.bio as string) || null,
      bio_recorded: Boolean((row.bio as string) || ""),
    })),
  };
}
