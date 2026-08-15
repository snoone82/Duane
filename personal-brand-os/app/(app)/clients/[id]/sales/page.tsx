import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SalesStrategyForm } from "@/components/clients/SalesStrategyForm";

export const metadata = { title: "Sales strategy" };

export default async function SalesStrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS: sales_strategy is strategic-tier — contractors get no row back and
  // land on the 404, same as Vision/Positioning.
  const { data: strategy } = await supabase.from("sales_strategy").select("*").eq("client_id", id).maybeSingle();
  if (!strategy) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-ink-soft">
        How the personal brand turns visibility into revenue — Visibility → Authority → Trust → Opportunity → Revenue. Saves as you go.
      </p>
      <SalesStrategyForm clientId={id} strategy={strategy} />
    </div>
  );
}
