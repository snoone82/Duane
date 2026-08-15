"use client";

// Client Component wrapper for the Sales tab's autosaving fields — same RSC
// rule as VisionForm: the onSave closures over the server action must be
// created client-side.
import { AutosaveTextarea } from "@/components/ui/AutosaveTextarea";
import { updateSalesStrategyField } from "@/lib/actions/sales";
import type { Database } from "@/lib/database.types";

type SalesStrategy = Database["public"]["Tables"]["sales_strategy"]["Row"];
type SalesField =
  | "services_products"
  | "target_customers"
  | "ideal_clients"
  | "offers"
  | "sales_messaging"
  | "lead_generation_approach"
  | "calls_to_action"
  | "lead_magnets"
  | "enquiry_process"
  | "sales_conversations"
  | "referral_opportunities";

const SECTIONS: { heading: string; fields: { key: SalesField; label: string; help: string }[] }[] = [
  {
    heading: "What they sell",
    fields: [
      { key: "services_products", label: "Services / products", help: "What the client actually sells — the things the brand ultimately drives revenue towards." },
      { key: "target_customers", label: "Target customers", help: "Who buys — companies, roles, sectors." },
      { key: "ideal_clients", label: "Ideal clients", help: "The best-fit buyers — the ones worth designing content and offers around." },
      { key: "offers", label: "Offers", help: "The specific packages, price points and entry offers." },
    ],
  },
  {
    heading: "How the brand sells",
    fields: [
      { key: "sales_messaging", label: "Sales messaging", help: "The commercial story — the problem, the promise, the proof." },
      { key: "lead_generation_approach", label: "Lead generation approach", help: "How attention becomes enquiries — inbound content, outbound, referrals, events." },
      { key: "calls_to_action", label: "Calls to action", help: "What content asks people to do — book a call, download, DM, subscribe." },
      { key: "lead_magnets", label: "Lead magnets", help: "The free value that captures interest — guides, scorecards, webinars." },
    ],
  },
  {
    heading: "Turning interest into revenue",
    fields: [
      { key: "enquiry_process", label: "Enquiry process", help: "What happens when someone puts a hand up — the steps from enquiry to call." },
      { key: "sales_conversations", label: "Sales conversations", help: "How calls are run — framing, qualifying, objections, closing." },
      { key: "referral_opportunities", label: "Referral opportunities", help: "Who could refer, and how the brand makes referring easy." },
    ],
  },
];

export function SalesStrategyForm({ clientId, strategy }: { clientId: string; strategy: SalesStrategy }) {
  return (
    <>
      {SECTIONS.map((section) => (
        <section key={section.heading} className="space-y-4">
          <h2 className="text-sm font-semibold text-ink">{section.heading}</h2>
          {section.fields.map((field) => (
            <AutosaveTextarea
              key={field.key}
              id={field.key}
              label={field.label}
              helpText={field.help}
              initialValue={strategy[field.key]}
              onSave={(value) => updateSalesStrategyField(clientId, field.key, value)}
            />
          ))}
        </section>
      ))}
    </>
  );
}
