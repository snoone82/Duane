"use client";

// Client Component wrapper for the Positioning tab — same reason as
// VisionForm: the onSave closures must be created client-side.
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updatePositioningField } from "@/lib/actions/positioning";
import type { Database } from "@/lib/database.types";

type Positioning = Database["public"]["Tables"]["positioning"]["Row"];
type PositioningField = "current_positioning" | "desired_positioning" | "positioning_statement" | "expertise" | "unique_story" | "differentiators" | "core_beliefs" | "contrarian_opinions";

const FIELDS: { key: PositioningField; label: string; help: string }[] = [
  { key: "current_positioning", label: "Current positioning", help: "How is the client currently perceived?" },
  { key: "desired_positioning", label: "Desired positioning", help: "How should the client eventually be perceived?" },
  { key: "positioning_statement", label: "Positioning statement", help: "Who they are + who they help/influence + what they stand for + why people should listen to them." },
  { key: "expertise", label: "Expertise", help: "Areas in which the client has genuine knowledge, credibility and experience." },
  { key: "unique_story", label: "Unique story", help: "The client's personal and professional journey." },
  { key: "differentiators", label: "Differentiators", help: "Why should someone listen to this person instead of another expert in the same field?" },
  { key: "core_beliefs", label: "Core beliefs", help: "Ideas or principles the client strongly believes." },
  { key: "contrarian_opinions", label: "Contrarian opinions", help: "Where the client may challenge conventional industry thinking — especially valuable for content and thought leadership." },
];

export function PositioningForm({ clientId, positioning }: { clientId: string; positioning: Positioning }) {
  return (
    <>
      {FIELDS.map((field) => (
        <AutosaveTextarea
          key={field.key}
          id={field.key}
          label={field.label}
          helpText={field.help}
          initialValue={positioning[field.key]}
          onSave={(value) => updatePositioningField(clientId, field.key, value)}
        />
      ))}
    </>
  );
}
