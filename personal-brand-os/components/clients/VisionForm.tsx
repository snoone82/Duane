"use client";

// Client Component wrapper for the Vision tab's autosaving fields. The
// onSave closures over the updateVisionField server action have to be
// created here, client-side — a closure built in the Server Component page
// can't be serialized across the RSC boundary ("Event handlers cannot be
// passed to Client Component props", caught live on Vercel).
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateVisionField } from "@/lib/actions/vision";
import type { Database } from "@/lib/database.types";

type Vision = Database["public"]["Tables"]["brand_vision"]["Row"];
type VisionField = "long_term_goal" | "desired_positioning" | "authority_goal" | "commercial_goal" | "impact_goal" | "legacy_contribution";

const FIELDS: { key: VisionField; label: string; help: string }[] = [
  { key: "long_term_goal", label: "Long-term personal brand goal", help: "What does the client ultimately want to become known for?" },
  { key: "desired_positioning", label: "Desired positioning", help: "How should people describe them when they are not in the room?" },
  { key: "authority_goal", label: "Authority goal", help: "What area do they want to become recognised as an authority in?" },
  { key: "commercial_goal", label: "Commercial goal", help: "How should the personal brand contribute to their income, business, career or opportunities?" },
  { key: "impact_goal", label: "Impact goal", help: "What impact do they want their voice and platform to have?" },
  { key: "legacy_contribution", label: "Legacy / contribution", help: "What do they ultimately want to contribute to their industry or audience?" },
];

export function VisionForm({ clientId, vision }: { clientId: string; vision: Vision }) {
  return (
    <>
      {FIELDS.map((field) => (
        <AutosaveTextarea
          key={field.key}
          id={field.key}
          label={field.label}
          helpText={field.help}
          initialValue={vision[field.key]}
          onSave={(value) => updateVisionField(clientId, field.key, value)}
        />
      ))}
    </>
  );
}
