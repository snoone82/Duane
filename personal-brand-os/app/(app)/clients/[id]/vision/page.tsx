import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VisionForm } from "@/components/clients/VisionForm";

export const metadata = { title: "Vision" };

export default async function VisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vision } = await supabase.from("brand_vision").select("*").eq("client_id", id).maybeSingle();
  if (!vision) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">What this brand ultimately wants to achieve. Saves as you go — no button to remember.</p>
      <VisionForm clientId={id} vision={vision} />
    </div>
  );
}
