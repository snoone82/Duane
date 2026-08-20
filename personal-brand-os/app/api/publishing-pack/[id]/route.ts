import { createClient } from "@/lib/supabase/server";
import { PdfBuilder } from "@/lib/pdf/builder";
import { formatDateTime } from "@/lib/format";

export const maxDuration = 60;

function safeFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Duane's §5: everything needed to publish one platform version, as one
 * clean branded document — final copy, media, CTA, tags, links, alt text,
 * notes and dates. Deliberately NOT a publishing integration; a pack a
 * human can post from without hunting through the system. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  // RLS scopes access (team with client access, or the linked portal client).
  const { data: output } = await supabase
    .from("content_outputs")
    .select("*, content:content_ideas(title, hook, target_publish_date), client:clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (!output) return Response.json({ error: "Platform version not found." }, { status: 404 });

  const pdf = await PdfBuilder.create();
  const title = output.content?.title ?? "Content";
  const clientName = output.client?.name ?? "Client";
  const when =
    output.status === "published" && output.published_at
      ? `Published ${formatDateTime(output.published_at)}`
      : output.scheduled_at
        ? `Scheduled for ${formatDateTime(output.scheduled_at)}`
        : output.content?.target_publish_date
          ? `Target date ${output.content.target_publish_date}`
          : "Not yet scheduled";

  await pdf.header(
    `Publishing Pack — ${output.platform}`,
    `${title} · ${clientName}`,
    `${output.format || "Format not set"} · ${when}`
  );

  pdf.heading("Final Approved Copy");
  pdf.divider();
  pdf.para(output.caption || "No copy on this version yet.");

  if (output.hashtags || output.cta || output.destination_link) {
    pdf.heading("Posting Details");
    if (output.cta) pdf.field("Call to action", output.cta);
    if (output.hashtags) pdf.field("Hashtags / tags", output.hashtags);
    if (output.destination_link) pdf.field("Destination link", output.destination_link);
  }

  if (output.alt_text) {
    pdf.field("Alt text", output.alt_text);
  }

  // Media: embed images directly; anything else gets its download link.
  if (output.media_url || output.thumbnail_url) {
    pdf.heading("Media");
    pdf.divider();
    for (const [label, url] of [
      ["Media asset", output.media_url],
      ["Thumbnail / cover", output.thumbnail_url],
    ] as const) {
      if (!url) continue;
      let embedded = false;
      try {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type") ?? "";
        if (response.ok && (contentType.includes("png") || contentType.includes("jpeg") || contentType.includes("jpg"))) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > 0 && bytes.length <= 15 * 1024 * 1024) {
            await pdf.image(bytes, contentType.includes("png") ? "png" : "jpg", label);
            embedded = true;
          }
        }
      } catch {
        // fall through to the link
      }
      if (!embedded) {
        pdf.field(label, `Download: ${url}`);
      }
    }
  }

  if (output.notes) {
    pdf.heading("Publishing Notes");
    pdf.divider();
    pdf.para(output.notes);
  }

  if (output.content?.hook) {
    pdf.spacer(4);
    pdf.note(`Master idea hook: ${output.content.hook}`);
  }

  const bytes = await pdf.finish(`Aligned Media · Publishing Pack · ${clientName} · ${title} · ${output.platform}`);
  const filename = `Publishing-Pack-${safeFilename(title)}-${safeFilename(output.platform)}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
