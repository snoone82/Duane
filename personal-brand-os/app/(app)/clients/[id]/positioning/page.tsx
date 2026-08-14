import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updatePositioningField } from "@/lib/actions/positioning";

export const metadata = { title: "Positioning" };

const FIELDS: { key: "current_positioning" | "desired_positioning" | "positioning_statement" | "expertise" | "unique_story" | "differentiators" | "core_beliefs" | "contrarian_opinions"; label: string; help: string }[] = [
  { key: "current_positioning", label: "Current positioning", help: "How is the client currently perceived?" },
  { key: "desired_positioning", label: "Desired positioning", help: "How should the client eventually be perceived?" },
  { key: "positioning_statement", label: "Positioning statement", help: "Who they are + who they help/influence + what they stand for + why people should listen to them." },
  { key: "expertise", label: "Expertise", help: "Areas in which the client has genuine knowledge, credibility and experience." },
  { key: "unique_story", label: "Unique story", help: "The client's personal and professional journey." },
  { key: "differentiators", label: "Differentiators", help: "Why should someone listen to this person instead of another expert in the same field?" },
  { key: "core_beliefs", label: "Core beliefs", help: "Ideas or principles the client strongly believes." },
  { key: "contrarian_opinions", label: "Contrarian opinions", help: "Where the client may challenge conventional industry thinking — especially valuable for content and thought leadership." },
];

export default async function PositioningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: positioning } = await supabase.from("positioning").select("*").eq("client_id", id).maybeSingle();
  if (!positioning) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">Who this person is. Saves as you go — no button to remember.</p>
      {FIELDS.map((field) => (
        <AutosaveTextarea
          key={field.key}
          id={field.key}
          label={field.label}
          helpText={field.help || undefined}
          initialValue={positioning[field.key]}
          onSave={(value) => updatePositioningField(id, field.key, value)}
        />
      ))}
    </div>
  );
}
