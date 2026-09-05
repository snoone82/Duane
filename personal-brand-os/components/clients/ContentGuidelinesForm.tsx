"use client";

// Client Component wrapper for the Content Guidelines tab's autosaving
// fields — same reason as VisionForm/PositioningForm: the onSave closures
// can't be built in the Server Component page and passed down.
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { AutosaveInput } from "@/components/ui/AutosaveInput";
import { updateContentGuidelinesField } from "@/lib/actions/content-guidelines";
import type { Database } from "@/lib/database.types";

type ContentGuidelines = Database["public"]["Tables"]["content_guidelines"]["Row"];

export function ContentGuidelinesForm({ clientId, guidelines }: { clientId: string; guidelines: ContentGuidelines }) {
  const save = (
    field:
      | "secondary_objectives"
      | "tone_voice_notes"
      | "preferred_language"
      | "avoid_language"
      | "cta_priorities"
      | "primary_cta_destination"
      | "content_safeguards"
  ) => (value: string) => updateContentGuidelinesField(clientId, field, value);

  return (
    <div className="space-y-5">
      <AutosaveTextarea
        id="secondary_objectives"
        label="Secondary objectives"
        helpText="Alongside the primary objective (set on Overview) — inherited by every new Monthly Plan, editable per month from there."
        initialValue={guidelines.secondary_objectives}
        onSave={save("secondary_objectives")}
      />
      <AutosaveTextarea
        id="tone_voice_notes"
        label="Tone / voice guidance"
        helpText="Applies across every platform unless a specific account's own tone overrides it."
        initialValue={guidelines.tone_voice_notes}
        onSave={save("tone_voice_notes")}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <AutosaveInput id="preferred_language" label="Preferred language" initialValue={guidelines.preferred_language} onSave={save("preferred_language")} />
        <AutosaveInput id="avoid_language" label="Avoid language / restrictions" initialValue={guidelines.avoid_language} onSave={save("avoid_language")} />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <AutosaveInput id="cta_priorities" label="CTA priorities / direction" initialValue={guidelines.cta_priorities} onSave={save("cta_priorities")} />
        <div>
          <AutosaveInput
            id="primary_cta_destination"
            label="Primary CTA destination"
            initialValue={guidelines.primary_cta_destination}
            onSave={save("primary_cta_destination")}
          />
          <p className="mt-1 text-xs text-ink-faint">Only if genuinely fixed — leave blank rather than guess; a missing destination is flagged, never invented.</p>
        </div>
      </div>
      <AutosaveTextarea
        id="content_safeguards"
        label="Hard content constraints"
        helpText="Included verbatim, non-negotiable, in every AI brief for this client when set — e.g. safeguarding rules for sensitive subject matter. Leave blank unless this client genuinely needs one."
        initialValue={guidelines.content_safeguards}
        onSave={save("content_safeguards")}
        rows={4}
      />
    </div>
  );
}
