import type { SupabaseServerClient } from "@/lib/supabase/server";

/** Fetch the client's profile photo (a long-lived signed URL on the clients
 * row) as bytes for embedding in a PDF masthead. Returns null on anything
 * unusable — no photo, unreachable URL, or a format pdf-lib can't embed —
 * so the PDF simply renders without it. */
export async function fetchClientPhoto(
  supabase: SupabaseServerClient,
  clientId: string
): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" } | null> {
  const { data: client } = await supabase.from("clients").select("photo_url").eq("id", clientId).maybeSingle();
  if (!client?.photo_url) return null;

  try {
    const response = await fetch(client.photo_url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    const kind = contentType.includes("png")
      ? ("png" as const)
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? ("jpg" as const)
        : null;
    if (!kind) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return null;
    return { bytes, kind };
  } catch {
    return null;
  }
}
