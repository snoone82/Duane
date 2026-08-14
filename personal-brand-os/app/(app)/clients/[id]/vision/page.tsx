import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateVisionField } from "@/lib/actions/vision";

export const metadata = { title: "Vision" };

const FIELDS: { key: "long_term_goal" | "desired_positioning" | "authority_goal" | "commercial_goal" | "impact_goal" | "legacy_contribution"; label: string; help: string }[] = [
  { key: "long_term_goal", label: "Long-term personal brand goal", help: "What does the client ultimately want to become known for?" },
  { key: "desired_positioning", label: "Desired positioning", help: "How should people describe them when they are not in the room?" },
  { key: "authority_goal", label: "Authority goal", help: "What area do they want to become recognised as an authority in?" },
  { key: "commercial_goal", label: "Commercial goal", help: "How should the personal brand contribute to their income, business, career or opportunities?" },
  { key: "impact_goal", label: "Impact goal", help: "What impact do they want their voice and platform to have?" },
  { key: "legacy_contribution", label: "Legacy / contribution", help: "What do they ultimately want to contribute to their industry or audience?" },
];

export default async function VisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vision } = await supabase.from("brand_vision").select("*").eq("client_id", id).maybeSingle();
  if (!vision) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">What this brand ultimately wants to achieve. Saves as you go — no button to remember.</p>
      {FIELDS.map((field) => (
        <AutosaveTextarea
          key={field.key}
          id={field.key}
          label={field.label}
          helpText={field.help}
          initialValue={vision[field.key]}
          onSave={(value) => updateVisionField(id, field.key, value)}
        />
      ))}
    </div>
  );
}
