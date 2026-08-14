import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PositioningForm } from "@/components/clients/PositioningForm";

export const metadata = { title: "Positioning" };

export default async function PositioningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: positioning } = await supabase.from("positioning").select("*").eq("client_id", id).maybeSingle();
  if (!positioning) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">Who this person is. Saves as you go — no button to remember.</p>
      <PositioningForm clientId={id} positioning={positioning} />
    </div>
  );
}
