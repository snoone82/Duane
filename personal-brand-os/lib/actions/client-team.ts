"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { runAction, type ActionResult } from "@/lib/action-result";
import { CLIENT_PERMISSIONS, readPermissions, type ClientPermissionKey } from "@/lib/client-team-permissions";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

function revalidateTeamPaths(clientId: string) {
  revalidatePath(`/clients/${clientId}/overview`);
  revalidatePath(`/clients/${clientId}/actions`);
  revalidatePath("/actions");
}

const MEMBER_FIELDS = ["name", "email", "organisation", "job_title", "member_role"] as const;
type MemberField = (typeof MEMBER_FIELDS)[number];
const MEMBER_STATUSES = ["invited", "active", "disabled"];

/** Add someone to a client's team (Duane Part A). Membership rows are the
 * only bridge between a login and a client — Charlie added to Daniel
 * Andrews exists nowhere else. */
export async function addClientMember(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Name is required." };

  const permissions: Record<string, boolean> = {};
  for (const perm of CLIENT_PERMISSIONS) {
    permissions[perm.key] = formData.get(`perm_${perm.key}`) === "on";
  }

  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_members").insert({
      client_id: clientId,
      name,
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      organisation: String(formData.get("organisation") ?? "").trim(),
      job_title: String(formData.get("job_title") ?? "").trim(),
      member_role: String(formData.get("member_role") ?? "").trim(),
      can_be_assigned: formData.get("can_be_assigned") === "on",
      permissions,
    });
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

export async function updateClientMemberField(
  clientId: string,
  memberId: string,
  field: MemberField,
  value: string
): Promise<ActionResult> {
  if (!MEMBER_FIELDS.includes(field)) return { ok: false, message: "Unknown field." };
  if (field === "name" && !value.trim()) return { ok: false, message: "Name can't be empty." };

  return runAction(async () => {
    const supabase = await createClient();
    const patch: Database["public"]["Tables"]["client_members"]["Update"] = {
      [field]: field === "email" ? value.trim().toLowerCase() : value.trim(),
    };
    const { error } = await supabase.from("client_members").update(patch).eq("id", memberId);
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

export async function setClientMemberStatus(clientId: string, memberId: string, status: string): Promise<ActionResult> {
  if (!MEMBER_STATUSES.includes(status)) return { ok: false, message: "Unknown status." };
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_members").update({ status }).eq("id", memberId);
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

export async function toggleClientMemberPermission(
  clientId: string,
  memberId: string,
  key: ClientPermissionKey,
  value: boolean
): Promise<ActionResult> {
  if (!CLIENT_PERMISSIONS.some((perm) => perm.key === key)) return { ok: false, message: "Unknown permission." };
  return runAction(async () => {
    const supabase = await createClient();
    const { data: member, error: readError } = await supabase
      .from("client_members")
      .select("permissions")
      .eq("id", memberId)
      .single();
    if (readError) throw new Error(readError.message);
    const permissions = { ...readPermissions(member.permissions), [key]: value };
    const { error } = await supabase.from("client_members").update({ permissions }).eq("id", memberId);
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

export async function toggleClientMemberAssignable(clientId: string, memberId: string, value: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_members").update({ can_be_assigned: value }).eq("id", memberId);
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

export async function deleteClientMember(clientId: string, memberId: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const { error } = await supabase.from("client_members").delete().eq("id", memberId);
    if (error) throw new Error(error.message);
    revalidateTeamPaths(clientId);
    return undefined;
  });
}

/** Create (or link) the portal login for a client-team member — the same
 * dashboard-only flow as the principal's portal login: anon signUp with a
 * throwaway password, role flipped to client, membership linked, and a
 * set-your-password email. If the email already has a client-role account,
 * it's linked instead of recreated. */
export async function createClientMemberLogin(clientId: string, memberId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return { ok: false, message: "Only admins can create portal logins." };

  return runAction(async () => {
    const supabase = await createClient();
    const { data: member, error: memberError } = await supabase
      .from("client_members")
      .select("id,email,user_id")
      .eq("id", memberId)
      .single();
    if (memberError) throw new Error(memberError.message);
    if (member.user_id) throw new Error("This member already has a login linked.");
    const email = member.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Add a valid email address to this member first.");
    }

    const bare = createBareClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signUpData, error: signUpError } = await bare.auth.signUp({
      email,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    });
    if (signUpError) {
      throw new Error(
        signUpError.message.toLowerCase().includes("signup")
          ? "Sign-ups are disabled in Supabase Auth settings — enable email sign-ups first."
          : signUpError.message
      );
    }

    let userId = signUpData.user?.id ?? null;
    const alreadyExists = !signUpData.user?.identities || signUpData.user.identities.length === 0;
    if (alreadyExists) {
      // The email already has an account — link it if it's a client-role one.
      const { data: existing } = await supabase.from("profiles").select("id,role").eq("email", email).maybeSingle();
      if (!existing) throw new Error("An account with that email exists but isn't visible — link it from Team & access.");
      if (existing.role !== "client") {
        throw new Error("That email belongs to an internal team account — client team members need their own client-role login.");
      }
      userId = existing.id;
    } else {
      if (!userId) throw new Error("The account wasn't created — try again.");
      let flipped = false;
      for (let attempt = 0; attempt < 4 && !flipped; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400));
        const { data } = await supabase.from("profiles").update({ role: "client" }).eq("id", userId).select("id");
        flipped = (data?.length ?? 0) > 0;
      }
      if (!flipped) throw new Error("The login was created but its role couldn't be set — set it to Client on Team & access, then link here.");
    }

    const { error: linkError } = await supabase.from("client_members").update({ user_id: userId }).eq("id", memberId);
    if (linkError) throw new Error(`The login exists but couldn't be linked: ${linkError.message}`);

    if (!alreadyExists) {
      const origin = (await headers()).get("origin") ?? "https://personal-brand-os-beta.vercel.app";
      const { error: resetError } = await bare.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password/confirm`,
      });
      if (resetError) {
        throw new Error(
          `The login is set up, but the password email didn't send (${resetError.message}). Ask them to use "Forgot password?" on the sign-in page.`
        );
      }
    }

    revalidateTeamPaths(clientId);
    revalidatePath("/team");
    return undefined;
  });
}
