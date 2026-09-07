import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildClientContext } from "@/lib/data/assistant";
import {
  ANALYSIS_SYSTEM_PROMPT,
  EXTRACTION_SCHEMA,
  parseExtractionJson,
  validateExtraction,
} from "@/lib/consultation-analysis";

// A full consultation transcript is a long read. Analysis is one call and
// the user is waiting on it, so give it room rather than failing at 60s.
export const maxDuration = 300;

const MODEL = "claude-opus-5";
// Roughly a two-hour transcript. Beyond this the useful move is to split the
// consultation, not to silently truncate the evidence.
const MAX_TRANSCRIPT_CHARS = 400_000;

export async function POST(request: Request) {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey || !/^sk-ant-[A-Za-z0-9_-]+$/.test(apiKey)) {
    return Response.json(
      { error: "Consultation analysis isn't configured yet — ANTHROPIC_API_KEY must be set in the environment." },
      { status: 503 }
    );
  }

  let body: { clientId?: string; consultationId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const clientId = (body.clientId ?? "").trim();
  const consultationId = (body.consultationId ?? "").trim();
  if (!clientId || !consultationId) return Response.json({ error: "A client and a consultation are required." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  // Everything below runs on the caller's RLS-scoped client: no access to
  // the client record means no rows and a 404, never a leak.
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id,meeting_date,meeting_type,attendees,transcript,summary")
    .eq("id", consultationId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!consultation) return Response.json({ error: "Consultation not found." }, { status: 404 });

  const raw = [consultation.transcript.trim(), consultation.summary.trim()].filter(Boolean).join("\n\n---\n\n");
  if (!raw) {
    return Response.json(
      { error: "This consultation has no transcript or notes to analyse — add the raw material first." },
      { status: 400 }
    );
  }
  if (raw.length > MAX_TRANSCRIPT_CHARS) {
    return Response.json(
      { error: `That transcript is ${Math.round(raw.length / 1000)}k characters — too long for one pass. Split the consultation into separate records and analyse each.` },
      { status: 400 }
    );
  }

  const context = await buildClientContext(supabase, clientId);
  if (!context) return Response.json({ error: "Client not found." }, { status: 404 });

  // What the library already holds, so the model doesn't re-propose it.
  const { data: existingItems } = await supabase
    .from("client_source_items")
    .select("kind,text")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);
  const existingBlock =
    (existingItems ?? []).length > 0
      ? (existingItems ?? []).map((i) => `- [${i.kind}] ${i.text}`).join("\n")
      : "(the Source Library is empty — everything you extract will be new)";

  // Previously rejected proposals, so a re-analysis doesn't keep offering
  // back what a person has already turned down.
  const { data: rejected } = await supabase
    .from("consultation_source_proposals")
    .select("text")
    .eq("client_id", clientId)
    .eq("state", "rejected")
    .limit(100);
  const rejectedBlock =
    (rejected ?? []).length > 0
      ? `\n\n## Already rejected by a reviewer — do not propose these again\n${(rejected ?? []).map((r) => `- ${r.text}`).join("\n")}`
      : "";

  const anthropic = new Anthropic({ apiKey });

  let replyText: string;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            "## The client's current profile",
            context,
            "",
            "## What the Source Library already holds — do not re-extract these",
            existingBlock,
            rejectedBlock,
            "",
            `## The consultation to analyse (${consultation.meeting_date}${consultation.meeting_type ? `, ${consultation.meeting_type}` : ""}${consultation.attendees ? `, attendees: ${consultation.attendees}` : ""})`,
            "",
            raw,
            "",
            "---",
            "",
            "Return valid JSON only, matching this shape (a description of the fields, not values to copy):",
            "",
            "```json",
            JSON.stringify(EXTRACTION_SCHEMA, null, 2),
            "```",
          ].join("\n"),
        },
      ],
    });
    replyText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `The analysis couldn't be completed: ${detail}` }, { status: 502 });
  }

  let extraction;
  let warnings: string[];
  try {
    ({ extraction, warnings } = validateExtraction(parseExtractionJson(replyText)));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `The analysis came back in a shape PBOS couldn't read: ${detail}` }, { status: 502 });
  }

  if (extraction.source_items.length === 0 && extraction.profile_changes.length === 0) {
    return Response.json(
      {
        error:
          "Nothing could be extracted from this consultation — there was no quotable source material in it. That is a valid outcome for a short or purely administrative meeting; the transcript is still saved.",
      },
      { status: 422 }
    );
  }

  // Persist the run and its proposals. Nothing here touches the Source
  // Library or the profile — a person approves each item first.
  const { data: analysis, error: analysisError } = await supabase
    .from("consultation_analyses")
    .insert({
      client_id: clientId,
      consultation_id: consultationId,
      model: MODEL,
      overview: extraction.overview,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (analysisError) return Response.json({ error: analysisError.message }, { status: 500 });

  if (extraction.source_items.length > 0) {
    const { error } = await supabase.from("consultation_source_proposals").insert(
      extraction.source_items.map((item, index) => ({
        analysis_id: analysis.id,
        client_id: clientId,
        kind: item.kind,
        text: item.text,
        source_quote: item.source_quote,
        sensitivity: item.sensitivity,
        sort_order: index,
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (extraction.profile_changes.length > 0) {
    const { error } = await supabase.from("profile_change_suggestions").insert(
      extraction.profile_changes.map((change) => ({
        analysis_id: analysis.id,
        client_id: clientId,
        area: change.area,
        field_label: change.field_label,
        current_value: change.current_value,
        suggested_value: change.suggested_value,
        rationale: change.rationale,
        evidence_quote: change.evidence_quote,
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    analysisId: analysis.id,
    sourceItems: extraction.source_items.length,
    profileChanges: extraction.profile_changes.length,
    warnings,
  });
}
