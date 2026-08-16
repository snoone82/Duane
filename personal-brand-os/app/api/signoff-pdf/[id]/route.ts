import { createClient } from "@/lib/supabase/server";
import { isStrategySnapshot } from "@/lib/signoff-snapshot";
import { buildStrategyPackPdf } from "@/lib/pdf/strategy-pack";
import { fetchClientPhoto } from "@/lib/pdf/client-photo";

export const maxDuration = 60;

function safeFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  // RLS scopes this: team members see their clients' packs, a portal client
  // sees only their own non-draft packs.
  const { data: pack } = await supabase.from("strategy_signoffs").select("*").eq("id", id).maybeSingle();
  if (!pack) return Response.json({ error: "Pack not found." }, { status: 404 });
  if (!isStrategySnapshot(pack.snapshot)) return Response.json({ error: "This pack's snapshot is unreadable." }, { status: 500 });

  const photo = await fetchClientPhoto(supabase, pack.client_id);
  const bytes = await buildStrategyPackPdf(
    pack.snapshot,
    {
      version: pack.version,
      status: pack.status,
      approvedByName: pack.approved_by_name,
      approvedAt: pack.approved_at,
      clientComments: pack.client_comments,
      createdAt: pack.created_at,
    },
    photo
  );

  const filename = `Strategy-Signoff-v${pack.version}-${safeFilename(pack.snapshot.clientName)}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
