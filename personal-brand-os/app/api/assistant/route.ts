import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildClientContext } from "@/lib/data/assistant";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are the strategy assistant inside Personal Brand OS, Aligned Media's client-management system for personal-branding clients. You help the team think about one client at a time.

You will be given everything the signed-in team member can see about the client — vision, positioning, pillars, audiences, platform strategies, sales strategy, recent meetings, open actions, metrics and pipelines. Ground every answer in that data: reference specific pillars, audiences, platforms and meetings by name, and say plainly when something you'd need is missing from the profile rather than inventing it.

The method behind the data is Visibility → Authority → Trust → Opportunity → Revenue: content builds visibility, consistent expertise builds authority, authority builds trust, trust creates opportunities, opportunities become revenue.

Keep answers practical and scoped to what a brand manager would act on this week. Use plain prose with short headings or lists only when they genuinely help. Currency is GBP.`;

export async function POST(request: Request) {
  // Tolerate the common paste mistakes (whitespace, surrounding quotes) but
  // refuse anything that isn't exactly one key. A malformed value must NEVER
  // reach the SDK: header-validation errors quote the offending value, and
  // an error that embeds the key can never be allowed anywhere near the
  // response stream.
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) {
    return Response.json(
      { error: "The assistant isn't configured yet — add an ANTHROPIC_API_KEY to the environment and redeploy." },
      { status: 503 }
    );
  }
  if (!/^sk-ant-[A-Za-z0-9_-]+$/.test(apiKey)) {
    return Response.json(
      {
        error:
          "The assistant's API key is set but malformed — the ANTHROPIC_API_KEY environment variable must contain just the key itself (it starts sk-ant-…), with nothing else pasted around it. Fix it in Vercel and redeploy.",
      },
      { status: 503 }
    );
  }

  let body: { clientId?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const clientId = (body.clientId ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  if (!clientId || !prompt) return Response.json({ error: "A client and a question are required." }, { status: 400 });
  if (prompt.length > 4000) return Response.json({ error: "That question is too long." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  // buildClientContext runs on the caller's RLS-scoped client: no access to
  // the client record means no context and a 404, and a contractor's context
  // simply omits the strategic tables their role can't read.
  const context = await buildClientContext(supabase, clientId);
  if (!context) return Response.json({ error: "Client not found." }, { status: 404 });

  const anthropic = new Anthropic({ apiKey });

  const messageStream = anthropic.beta.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is everything on file for this client:\n\n${context}\n\n---\n\n${prompt}`,
      },
    ],
    // Server-side fallback: on the rare safety-classifier decline, the
    // request re-runs on Anthropic's recommended fallback model instead of
    // returning an empty answer.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  } as Parameters<typeof anthropic.beta.messages.stream>[0]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      messageStream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      try {
        const final = await messageStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nI can't help with that particular request — try rephrasing it."));
        }
        controller.close();
      } catch (err) {
        // Full detail goes to the server logs ONLY — raw SDK error messages
        // can quote header values and request internals, so nothing from the
        // error object is ever echoed into the client-visible stream.
        console.error("assistant model call failed:", err);
        const status = err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : undefined;
        const friendly =
          status === 401 || status === 403
            ? "the API key was rejected — it may need replacing in Vercel"
            : status === 429
              ? "the model is rate-limited right now — try again in a minute"
              : "something went wrong talking to the model — the team can see the details in the server logs";
        controller.enqueue(encoder.encode(`\n\n[The assistant hit a problem: ${friendly}.]`));
        controller.close();
      }
    },
    cancel() {
      messageStream.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
