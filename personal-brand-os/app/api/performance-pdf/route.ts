import { createClient } from "@/lib/supabase/server";
import { buildPerformanceData } from "@/lib/data/performance";
import { buildPerformanceReportPdf } from "@/lib/pdf/performance-report";

export const maxDuration = 60;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function safeFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const label = (url.searchParams.get("label") ?? "Performance report").slice(0, 60);
  if (!clientId || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return Response.json({ error: "clientId, from and to (YYYY-MM-DD) are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const data = await buildPerformanceData(supabase, clientId, from, to, label);
  if (!data) return Response.json({ error: "Client not found." }, { status: 404 });

  const bytes = await buildPerformanceReportPdf(data);
  const filename = `Performance-Report-${safeFilename(label)}-${safeFilename(data.clientName)}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
