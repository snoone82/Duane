import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * The landing point for every emailed auth link.
 *
 * There wasn't one before, and that was the bug behind Duane's "this link's
 * no longer valid" loop. The reset page relied entirely on the BROWSER
 * client noticing the link and exchanging it, and @supabase/ssr pins the
 * browser client to the PKCE flow. PKCE only completes if the same browser
 * still holds the code verifier it stored when the reset was requested —
 * supabase-js checks for it and, finding nothing, silently declines to even
 * attempt the exchange (_isPKCECallback returns false, so the code in the
 * URL is ignored rather than rejected). The page then asked "is anyone
 * signed in?", got no, and reported the link as expired.
 *
 * Which means a perfectly good link fails whenever the click happens
 * somewhere other than where the request was made: email opened on the
 * phone but requested on the laptop, an in-app webview inside Gmail or
 * Outlook, a different profile, a private window, cookies cleared in
 * between — or an admin sending the link from the Supabase dashboard, where
 * no verifier was ever created at all. That covers every route Duane tried.
 *
 * So the exchange moves server-side and supports both shapes:
 *
 *   ?token_hash=&type=  verifyOtp — no verifier, no shared browser state.
 *                       Works from any device. This is the one to use, and
 *                       it needs the email templates pointed here.
 *   ?code=              exchangeCodeForSession, reading the verifier from
 *                       the request cookies. Same-browser only, by design of
 *                       PKCE — kept so existing unexpired links still work.
 *
 * A link carrying its tokens in the URL fragment (#access_token=...) never
 * reaches the server at all, so that case falls through to `next`, where the
 * browser client picks it up.
 */

const FALLBACK = "/reset-password/confirm";

/** Only ever redirect within this app — `next` arrives from a URL. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function failed(request: NextRequest, reason: string, next: string) {
  const url = new URL(FALLBACK, request.url);
  url.searchParams.set("reason", reason);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));

  // Supabase reports its own failures (expired, already used, disallowed
  // redirect) on the query string. Pass the real reason through rather than
  // guessing at it later.
  const suppliedError = params.get("error_code") ?? params.get("error");
  if (suppliedError) {
    return failed(request, suppliedError, next);
  }

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return failed(request, error.code ?? "verify_failed", next);
    return NextResponse.redirect(new URL(next, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // The verifier cookie belongs to the browser that asked for the link. If
    // it isn't on this request, this is the cross-browser case — say so,
    // because "expired" sends people round the loop again.
    if (error) return failed(request, error.code ?? "code_exchange_failed", next);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Nothing usable server-side — likely an implicit-flow link whose tokens
  // are in the fragment. Let the destination page's browser client try.
  return NextResponse.redirect(new URL(next, request.url));
}
