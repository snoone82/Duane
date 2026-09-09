"use client";

// Current Commercial Focus (Duane, working through the client Strategy
// page). Three lines that sit between the North Star — where the brand is
// ultimately heading — and the monthly objective, which is only about this
// month. They change a few times a year, not monthly.
//
// The client sees these on their own Strategy page, so they are written to
// be read by the client rather than about them.
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateClientField } from "@/lib/actions/clients";

export function CommercialFocusCard({
  clientId,
  flagshipOffer,
  commercialPriority,
  brandRole,
}: {
  clientId: string;
  flagshipOffer: string;
  commercialPriority: string;
  brandRole: string;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Current commercial focus</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          What the brand is working towards this quarter. Shown on the client&rsquo;s own Strategy page.
        </p>
      </div>
      <AutosaveTextarea
        id="client-flagship-offer"
        label="Flagship"
        helpText="The offer the brand is currently leading with — e.g. AI Champion to Boardroom."
        initialValue={flagshipOffer}
        onSave={(value) => updateClientField(clientId, "flagship_offer", value)}
        rows={2}
      />
      <AutosaveTextarea
        id="client-commercial-priority"
        label="Priority"
        helpText="What the content is being asked to achieve right now — e.g. build qualified attention and information-pack sign-ups this quarter."
        initialValue={commercialPriority}
        onSave={(value) => updateClientField(clientId, "commercial_priority", value)}
        rows={2}
      />
      <AutosaveTextarea
        id="client-brand-role"
        label="Role"
        helpText="The wider authority being built alongside the flagship offer — e.g. governance, law, M&A and commercial judgement."
        initialValue={brandRole}
        onSave={(value) => updateClientField(clientId, "brand_role", value)}
        rows={2}
      />
    </section>
  );
}
