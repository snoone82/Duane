"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import { previewBlock } from "@/lib/preview";
import { UserFacingError } from "@/lib/errors";
import { getPortalContext } from "@/lib/data/portal";
import { createAyrshareProfile, getAyrshareLinkUrl, getLinkedNetworks, guessAyrsharePlatform } from "@/lib/ayrshare";

/**
 * The client connects their own social accounts (Duane's brief, 29 Aug).
 *
 * Everything sensitive stays on this side of the wire. The client is sent to
 * Ayrshare's own authorisation page, signs in to the social network there,
 * and grants access directly — no social password is ever typed into PBOS,
 * seen by Aligned Media or stored anywhere. The Ayrshare account API key
 * lives in the environment and never leaves the server; the only thing this
 * module hands the browser is a short-lived link.
 */

/** The client's connection profile, created on first use so nobody has to
 * set anything up in the backend first. */
async function ensureConnectionProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  clientName: string
): Promise<{ id: string; profileKey: string }> {
  const { data: existing, error } = await supabase
    .from("ayrshare_profiles")
    .select("id,profile_key")
    .eq("client_id", clientId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new UserFacingError(error.message);
  if (existing) return { id: existing.id, profileKey: existing.profile_key };

  const created = await createAyrshareProfile(clientName);
  const { data: row, error: insertError } = await supabase
    .from("ayrshare_profiles")
    .insert({ client_id: clientId, title: clientName, profile_key: created.profileKey, ref_id: created.refId })
    .select("id,profile_key")
    .single();
  if (insertError) throw new UserFacingError(`The connection was created but couldn't be saved: ${insertError.message}`);
  return { id: row.id, profileKey: row.profile_key };
}

/**
 * The URL of Ayrshare's branded authorisation page for this client. The
 * token inside it expires in minutes, so it's generated on demand and opened
 * straight away rather than rendered into the page.
 */
export async function portalGetConnectUrl(): Promise<ActionResult<string>> {
  const previewRefusal = await previewBlock();
  if (previewRefusal) return previewRefusal;
  return runAction(async () => {
    const context = await getPortalContext();
    if (!context) throw new UserFacingError("Your account isn't linked to a client profile yet.");
    if (!context.can("connect_social")) {
      throw new UserFacingError("Connecting social accounts isn't enabled for your account — ask your Aligned Media contact.");
    }

    const supabase = await createClient();
    const { profileKey } = await ensureConnectionProfile(supabase, context.client.id, context.client.name);
    revalidatePath("/portal/accounts");
    return getAyrshareLinkUrl(profileKey);
  });
}

export interface PortalConnection {
  /** The PBOS social account this maps to, when there is one. */
  accountId: string | null;
  platform: string;
  accountName: string;
  connected: boolean;
}

/**
 * What's connected right now, asked of Ayrshare rather than remembered — a
 * connection that's been revoked at the social network shows as
 * disconnected here, which is what makes "needs attention" honest.
 */
export async function portalConnectionStatus(): Promise<ActionResult<PortalConnection[]>> {
  return runAction(async () => {
    const context = await getPortalContext();
    if (!context) throw new UserFacingError("Your account isn't linked to a client profile yet.");
    if (!context.can("connect_social")) {
      throw new UserFacingError("Connecting social accounts isn't enabled for your account.");
    }

    const supabase = await createClient();
    const [{ data: profile }, { data: accounts }] = await Promise.all([
      supabase.from("ayrshare_profiles").select("profile_key").eq("client_id", context.client.id).order("created_at").limit(1).maybeSingle(),
      supabase
        .from("social_strategies")
        .select("id,platform,account_name,ayrshare_platform,account_status")
        .eq("client_id", context.client.id)
        .neq("account_status", "inactive")
        .order("sort_order"),
    ]);

    const linked = profile ? await getLinkedNetworks(profile.profile_key) : [];
    const linkedSet = new Set(linked.map((network) => network.toLowerCase()));

    // Every account the team has set up for this client, plus anything the
    // client has linked that PBOS doesn't have a record for yet.
    const rows: PortalConnection[] = (accounts ?? []).map((account) => {
      const slug = (account.ayrshare_platform || guessAyrsharePlatform(account.platform)).toLowerCase();
      return {
        accountId: account.id,
        platform: account.platform,
        accountName: account.account_name,
        connected: Boolean(slug) && linkedSet.has(slug),
      };
    });

    const known = new Set(
      (accounts ?? []).map((a) => (a.ayrshare_platform || guessAyrsharePlatform(a.platform)).toLowerCase()).filter(Boolean)
    );
    for (const network of linkedSet) {
      if (!known.has(network)) {
        rows.push({ accountId: null, platform: network, accountName: "", connected: true });
      }
    }

    return rows;
  });
}
