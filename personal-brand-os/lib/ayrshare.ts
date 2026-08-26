/**
 * Thin Ayrshare API client (https://www.ayrshare.com/docs). Server-only:
 * the API key and JWT private key live in env vars and never reach the
 * browser or the database. Feature-flagged — with no AYRSHARE_API_KEY set,
 * isAyrshareConfigured() is false and none of the publishing UI renders.
 *
 * Model: an Ayrshare "profile" = one identity (Daniel Andrews, CEG…) with
 * one linked account per network. Calls without a profileKey act on the
 * account's Primary Profile.
 */

import { UserFacingError } from "@/lib/errors";

const API_BASE = "https://api.ayrshare.com/api";

export const AYRSHARE_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
  "twitter",
  "tiktok",
  "youtube",
  "pinterest",
  "gmb",
] as const;

/** Platforms Ayrshare refuses without media attached. */
export const MEDIA_REQUIRED_PLATFORMS = ["instagram", "tiktok", "youtube", "pinterest"];

export function isAyrshareConfigured(): boolean {
  return Boolean(process.env.AYRSHARE_API_KEY?.trim());
}

/** Best-guess slug from a free-text platform name ("LinkedIn" → linkedin). */
export function guessAyrsharePlatform(platform: string): string {
  const p = platform.trim().toLowerCase();
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("facebook")) return "facebook";
  if (p.includes("twitter") || p === "x") return "twitter";
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("youtube")) return "youtube";
  if (p.includes("pinterest")) return "pinterest";
  if (p.includes("google")) return "gmb";
  return "";
}

interface AyrRequest {
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  profileKey?: string | null;
}

async function ayr<T = Record<string, unknown>>(path: string, options: AyrRequest = {}): Promise<T> {
  const key = process.env.AYRSHARE_API_KEY?.trim();
  if (!key) throw new UserFacingError("Ayrshare isn't configured — add AYRSHARE_API_KEY in Vercel and redeploy.");

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.profileKey ? { "Profile-Key": options.profileKey } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || data.status === "error") {
    // Surface Ayrshare's own message (safe — our key is in the header, never
    // echoed in their error bodies), fall back to the HTTP status.
    const errors = Array.isArray(data.errors)
      ? (data.errors as { message?: string; msg?: string }[]).map((e) => e.message ?? e.msg).filter(Boolean)
      : [];
    const message = errors.join("; ") || (typeof data.message === "string" ? data.message : "") || `Ayrshare returned ${response.status}`;
    // Also log server-side so Vercel's runtime logs carry the detail.
    console.error(`Ayrshare ${options.method ?? "GET"} ${path} failed:`, message);
    throw new UserFacingError(message);
  }
  return data as T;
}

// --- Profiles (identities) --------------------------------------------------

export async function createAyrshareProfile(title: string): Promise<{ profileKey: string; refId: string }> {
  const data = await ayr<{ profileKey?: string; refId?: string }>("/profiles/profile", {
    method: "POST",
    body: { title },
  });
  if (!data.profileKey) throw new UserFacingError("Ayrshare didn't return a profile key.");
  return { profileKey: data.profileKey, refId: data.refId ?? "" };
}

/** PEM keys get mangled by env-var paste boxes: newlines become spaces,
 * vanish entirely, or arrive as literal "\n". RS256 signing then fails with
 * "secretOrPrivateKey must be an asymmetric key". This rebuilds a valid PEM
 * from whatever shape survived the paste. */
function normalizePem(raw: string): string {
  const value = raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const match = value.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END [A-Z0-9 ]+-----/);
  if (match) {
    const label = match[1];
    const body = (match[2] ?? "").replace(/\s/g, "");
    const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
    return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
  }
  // Header/footer lost entirely but the base64 body survived: wrap it.
  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").length > 100) {
    const body = value.replace(/\s/g, "");
    const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
    return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;
  }
  return value;
}

/** The branded social-linking page URL for one profile — open it in a new
 * tab and the person connects their LinkedIn/Instagram/etc. The JWT is
 * valid for ~5 minutes, so generate on click, never ahead of time. */
export async function getAyrshareLinkUrl(profileKey: string): Promise<string> {
  const domain = process.env.AYRSHARE_DOMAIN?.trim();
  const rawKey = process.env.AYRSHARE_PRIVATE_KEY;
  if (!domain || !rawKey?.trim()) {
    throw new UserFacingError("Account linking needs AYRSHARE_DOMAIN and AYRSHARE_PRIVATE_KEY set in Vercel.");
  }
  const privateKey = normalizePem(rawKey);
  const data = await ayr<{ url?: string; token?: string }>("/profiles/generateJWT", {
    method: "POST",
    body: { domain, privateKey, profileKey, logout: true },
  });
  if (data.url) return data.url;
  if (data.token) return `https://profile.ayrshare.com/social-accounts?domain=${domain}&jwt=${data.token}`;
  throw new UserFacingError("Ayrshare didn't return a linking URL.");
}

/** Which networks are actually linked on a profile right now. */
export async function getLinkedNetworks(profileKey: string | null): Promise<string[]> {
  const data = await ayr<{ activeSocialAccounts?: string[] }>("/user", { profileKey });
  return data.activeSocialAccounts ?? [];
}

// --- Posting ----------------------------------------------------------------

export interface AyrsharePostResult {
  /** Ayrshare's post record id — used later to check a scheduled post. */
  id: string;
  /** Live post URL when the post went out immediately. */
  postUrl: string | null;
  scheduled: boolean;
}

export async function sendAyrsharePost(input: {
  post: string;
  platform: string;
  mediaUrls?: string[];
  scheduleDate?: string; // ISO — omit to publish immediately
  profileKey?: string | null;
}): Promise<AyrsharePostResult> {
  const data = await ayr<{
    id?: string;
    status?: string;
    postIds?: { platform?: string; postUrl?: string; status?: string; id?: string }[];
  }>("/post", {
    method: "POST",
    body: {
      post: input.post,
      platforms: [input.platform],
      ...(input.mediaUrls && input.mediaUrls.length > 0 ? { mediaUrls: input.mediaUrls } : {}),
      ...(input.scheduleDate ? { scheduleDate: input.scheduleDate } : {}),
    },
    profileKey: input.profileKey,
  });
  return {
    id: data.id ?? "",
    postUrl: data.postIds?.[0]?.postUrl ?? null,
    scheduled: Boolean(input.scheduleDate),
  };
}

/** Check a post (typically a scheduled one): returns the live URL once it
 * has actually gone out, null while still pending. */
export async function getAyrsharePostUrl(postId: string, profileKey?: string | null): Promise<{ postUrl: string | null; status: string }> {
  const data = await ayr<{
    status?: string;
    postIds?: { postUrl?: string; status?: string }[];
  }>(`/post/${postId}`, { profileKey });
  const posted = data.postIds?.find((p) => p.postUrl);
  return { postUrl: posted?.postUrl ?? null, status: typeof data.status === "string" ? data.status : "unknown" };
}
