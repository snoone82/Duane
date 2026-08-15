"use client";

// The one-sentence "what all of this is for" — Duane wants it front and
// centre at the top of Overview. Autosaves like everything else.
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateClientField } from "@/lib/actions/clients";

export function NorthStarCard({ clientId, northStar }: { clientId: string; northStar: string }) {
  return (
    <section className="rounded-lg border border-accent/40 bg-surface p-4">
      <AutosaveTextarea
        id="client-north-star"
        label="North Star"
        helpText="The single guiding statement everything else serves — where this personal brand is ultimately heading."
        initialValue={northStar}
        onSave={(value) => updateClientField(clientId, "north_star", value)}
        rows={2}
      />
    </section>
  );
}
