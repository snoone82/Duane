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

/**
 * Everything Ayrshare said when a call failed.
 *
 * Duane could only ever see "Ayrshare returned 400", which doesn't
 * distinguish an unsupported codec from a wrong aspect ratio, a
 * disconnected account or a media URL the platform couldn't fetch. All of it
 * is carried here and stored against the platform version.
 */
export class AyrshareError extends UserFacingError {
  readonly status: number;
  readonly code: string | null;
  readonly platform: string | null;
  readonly postId: string | null;
  /** The raw response body, pretty-printed, for the troubleshooting view. */
  readonly body: string;

  constructor(input: {
    message: string;
    status: number;
    code?: string | null;
    platform?: string | null;
    postId?: string | null;
    body: unknown;
  }) {
    super(input.message);
    this.name = "AyrshareError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.platform = input.platform ?? null;
    this.postId = input.postId ?? null;
    this.body = JSON.stringify(input.body, null, 2);
  }

  /** One block of text holding everything worth keeping, stored verbatim. */
  toRecord(): string {
    return [
      `HTTP status: ${this.status}`,
      this.code ? `Ayrshare code: ${this.code}` : null,
      this.platform ? `Platform: ${this.platform}` : null,
      this.postId ? `Ayrshare post id: ${this.postId}` : null,
      `Message: ${this.message}`,
      "",
      "Full response:",
      this.body,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }
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
    // Ayrshare nests the useful part differently depending on where the
    // failure happened — its own validation, or the platform pushing back —
    // so look in both, and keep the whole body either way.
    const errorList = Array.isArray(data.errors) ? (data.errors as Record<string, unknown>[]) : [];
    const posts = Array.isArray(data.postIds) ? (data.postIds as Record<string, unknown>[]) : [];
    const platformError = posts.find((post) => post.status === "error" || post.errorMessage);
    const first: Record<string, unknown> = errorList[0] ?? platformError ?? {};

    const pick = (...keys: string[]): string | null => {
      for (const key of keys) {
        const value = first[key] ?? data[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return null;
    };

    const message =
      pick("message", "msg", "errorMessage", "error") ||
      errorList.map((e) => e.message ?? e.msg).filter(Boolean).join("; ") ||
      `Ayrshare returned ${response.status}`;

    const rawCode = first.code ?? data.code;
    // Server-side log carries the whole body for Vercel's runtime logs. Our
    // API key lives in the request header and is never echoed back, so the
    // response body is safe to record.
    console.error(`Ayrshare ${options.method ?? "GET"} ${path} failed:`, JSON.stringify(data));
    throw new AyrshareError({
      message,
      status: response.status,
      code: rawCode === undefined || rawCode === null ? null : String(rawCode),
      platform: pick("platform"),
      postId: pick("id", "postId", "refId"),
      body: data,
    });
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

export interface AyrshareYouTubeOptions {
  /** Required by Ayrshare. Max 100 characters. */
  title: string;
  /** Ayrshare's default is "private" — never what a client wants from a
   * scheduled post, so the caller always sets this explicitly. */
  visibility: "public" | "unlisted" | "private";
  /** Post as a YouTube Short (video must be 3 minutes or under). */
  shorts?: boolean;
}

/** Ayrshare's hard limit on youTubeOptions.title. */
export const YOUTUBE_TITLE_MAX = 100;

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
  /** Tell Ayrshare the media is video. A Supabase signed URL ends in a token
   * rather than ".mp4", so Ayrshare can't infer the type from the path — and
   * a video treated as an image is rejected by the platform. */
  isVideo?: boolean;
  /** YouTube is the one network that rejects a bare post: Ayrshare requires
   * youTubeOptions.title (max 100 chars), and defaults visibility to
   * PRIVATE, so both are always sent for YouTube. */
  youTubeOptions?: AyrshareYouTubeOptions;
  scheduleDate?: string; // ISO — omit to publish immediately
  profileKey?: string | null;
}): Promise<AyrsharePostResult> {
  const data = await ayr<AyrsharePostResponse>("/post", {
    method: "POST",
    body: {
      post: input.post,
      platforms: [input.platform],
      ...(input.mediaUrls && input.mediaUrls.length > 0 ? { mediaUrls: input.mediaUrls } : {}),
      ...(input.isVideo ? { isVideo: true } : {}),
      ...(input.youTubeOptions ? { youTubeOptions: input.youTubeOptions } : {}),
      ...(input.scheduleDate ? { scheduleDate: input.scheduleDate } : {}),
    },
    profileKey: input.profileKey,
  });
  // With a Profile-Key (a client's own profile) Ayrshare nests the result
  // under posts[0] and there is NO top-level id. Reading data.id alone
  // silently lost every post id and live link for Jonny — which is why
  // his versions showed "PBOS only" after a successful handover.
  const record = unwrapPostRecord(data);
  return {
    id: record.id ?? "",
    postUrl: record.postIds?.find((p) => p.postUrl)?.postUrl ?? null,
    scheduled: Boolean(input.scheduleDate),
  };
}

interface AyrsharePlatformPost {
  platform?: string;
  postUrl?: string;
  status?: string;
  id?: string;
}

interface AyrsharePostRecord {
  id?: string;
  status?: string;
  refId?: string;
  post?: string;
  platforms?: string[];
  scheduleDate?: string | { _seconds?: number; utc?: string };
  created?: string | { _seconds?: number; utc?: string };
  postIds?: AyrsharePlatformPost[];
}

type AyrsharePostResponse = AyrsharePostRecord & { posts?: AyrsharePostRecord[] };

/** The one post record inside either response shape (primary account vs
 * Profile-Key). */
function unwrapPostRecord(data: AyrsharePostResponse): AyrsharePostRecord {
  if (Array.isArray(data.posts) && data.posts.length > 0) return data.posts[0] as AyrsharePostRecord;
  return data;
}

/** Ayrshare returns dates as ISO strings in some places and Firestore-style
 * objects in others (history). Normalise to ISO or null. */
function ayrDate(value: AyrsharePostRecord["created"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return Number.isNaN(new Date(value).getTime()) ? null : new Date(value).toISOString();
  if (typeof value.utc === "string") return ayrDate(value.utc);
  if (typeof value._seconds === "number") return new Date(value._seconds * 1000).toISOString();
  return null;
}

// --- History (reconciliation) ----------------------------------------------

export interface AyrshareHistoryRecord {
  id: string;
  post: string;
  platforms: string[];
  status: string;
  createdAt: string | null;
  scheduledAt: string | null;
  postIds: { platform: string; id: string | null; postUrl: string | null; status: string | null }[];
}

/**
 * Every post this profile has sent through Ayrshare recently. Used to
 * recover post ids for versions published before the Profile-Key shape was
 * handled — and as a safety net whenever a handover's id goes missing.
 */
export async function getAyrshareHistory(profileKey: string | null, lastDays = 90): Promise<AyrshareHistoryRecord[]> {
  const data = await ayr<{ history?: AyrsharePostRecord[]; posts?: AyrsharePostRecord[] } | AyrsharePostRecord[]>(
    `/history?lastDays=${lastDays}&limit=1000`,
    { profileKey }
  );
  const list: AyrsharePostRecord[] = Array.isArray(data) ? data : (data.history ?? data.posts ?? []);
  return list
    .filter((r): r is AyrsharePostRecord & { id: string } => typeof r.id === "string" && r.id.length > 0)
    .map((r) => ({
      id: r.id,
      post: typeof r.post === "string" ? r.post : "",
      platforms: Array.isArray(r.platforms) ? r.platforms.map(String) : [],
      status: typeof r.status === "string" ? r.status : "",
      createdAt: ayrDate(r.created),
      scheduledAt: ayrDate(r.scheduleDate),
      postIds: (r.postIds ?? []).map((p) => ({
        platform: String(p.platform ?? ""),
        id: p.id ? String(p.id) : null,
        postUrl: p.postUrl ? String(p.postUrl) : null,
        status: p.status ? String(p.status) : null,
      })),
    }));
}

// --- Analytics --------------------------------------------------------------

export interface AyrsharePostAnalytics {
  reach: number | null;
  views: number | null;
  engagement: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** Everything the network reported, verbatim. */
  raw: Record<string, unknown>;
  postUrl: string | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** First numeric value among the candidate keys, else null. */
function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (isNum(value)) return Math.round(value);
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Math.round(Number(value));
  }
  return null;
}

/**
 * Normalise one network's analytics object into the six numbers PBOS keeps.
 *
 * Each network names things differently (Instagram reachCount, TikTok
 * reach, LinkedIn uniqueImpressionsCount…), so this maps by meaning:
 *   reach      — unique accounts reached, else impressions
 *   views      — video plays, else impressions
 *   engagement — the network's own count where it gives one, else the sum
 *                of likes + comments + shares + saves that were reported
 */
export function normaliseAnalytics(analytics: Record<string, unknown>, postUrl: string | null): AyrsharePostAnalytics {
  const likes = firstNumber(analytics, ["likeCount", "likes", "reactionCount", "favoriteCount", "diggCount"]);
  const comments = firstNumber(analytics, ["commentsCount", "commentCount", "comments", "replyCount"]);
  const shares = firstNumber(analytics, ["sharesCount", "shareCount", "shares", "retweetCount", "repostCount"]);
  const saves = firstNumber(analytics, ["savedCount", "saveCount", "saves", "bookmarkCount"]);
  const reach = firstNumber(analytics, ["reachCount", "reach", "uniqueImpressionsCount", "impressionCount", "impressions"]);
  const views = firstNumber(analytics, [
    "videoViews",
    "views",
    "viewsCount",
    "playsCount",
    "igReelsAggregatedAllPlaysCount",
    "mediaView",
    "viewCount",
    "impressionCount",
    "impressions",
  ]);
  let engagement = firstNumber(analytics, ["engagementCount", "engagements", "totalEngagement"]);
  if (engagement === null) {
    const parts = [likes, comments, shares, saves].filter((v): v is number => v !== null);
    engagement = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
  }
  return { reach, views, engagement, likes, comments, shares, raw: analytics, postUrl };
}

/**
 * Performance numbers for one post on one network.
 *
 * Read-only: nothing is posted, changed or deleted at Ayrshare or the
 * network — it is the same data the network shows in its own app.
 * TikTok and YouTube take 24–48 hours after publishing to report anything.
 */
export async function getAyrsharePostAnalytics(
  postId: string,
  platform: string,
  profileKey: string | null
): Promise<AyrsharePostAnalytics> {
  const data = await ayr<Record<string, unknown>>("/analytics/post", {
    method: "POST",
    body: { id: postId, platforms: [platform] },
    profileKey,
  });
  const entry = data[platform];
  if (!entry || typeof entry !== "object") {
    const errors = Array.isArray(data.errors) ? (data.errors as Record<string, unknown>[]) : [];
    const first = errors.find((e) => e.platform === platform) ?? errors[0];
    const message =
      (first && typeof first.message === "string" && first.message) ||
      `Ayrshare returned no ${platform} analytics for this post yet.`;
    throw new UserFacingError(message);
  }
  const block = entry as { analytics?: Record<string, unknown>; postUrl?: string };
  const analytics = block.analytics && typeof block.analytics === "object" ? block.analytics : {};
  return normaliseAnalytics(analytics, typeof block.postUrl === "string" ? block.postUrl : null);
}

/** Check a post (typically a scheduled one): returns the live URL once it
 * has actually gone out, null while still pending. */
export async function getAyrsharePostUrl(postId: string, profileKey?: string | null): Promise<{ postUrl: string | null; status: string }> {
  const data = unwrapPostRecord(await ayr<AyrsharePostResponse>(`/post/${postId}`, { profileKey }));
  const posted = data.postIds?.find((p) => p.postUrl);
  return { postUrl: posted?.postUrl ?? null, status: typeof data.status === "string" ? data.status : "unknown" };
}
