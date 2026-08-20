import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getSalesOverview } from "@/lib/data/sales";
import { SalesTargetForm } from "@/components/sales/SalesTargetForm";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const [overview, { data: clients }] = await Promise.all([
    getSalesOverview(supabase),
    supabase.from("clients").select("id,name,status,retainer_amount").order("name"),
  ]);

  const progress =
    overview.monthlyTarget && overview.monthlyTarget > 0
      ? Math.min(100, Math.round((overview.actualThisMonth / overview.monthlyTarget) * 100))
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Sales</h1>
      <p className="mb-6 text-sm text-ink-soft">
        The business-level sales picture. Per-client sales strategy lives on each client&rsquo;s Sales tab; recorded wins come
        from each client&rsquo;s commercial outcomes.
      </p>

      <div className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">This month</h2>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-ink-faint">Monthly sales target</p>
            <p className="text-xl font-semibold text-ink">
              {overview.monthlyTarget !== null ? formatCurrency(overview.monthlyTarget) : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-faint">Recorded this month</p>
            <p className="text-xl font-semibold text-ink">{formatCurrency(overview.actualThisMonth)}</p>
            <p className="text-xs text-ink-faint">
              {overview.outcomesThisMonth} outcome{overview.outcomesThisMonth === 1 ? "" : "s"}
            </p>
          </div>
          {progress !== null && (
            <div>
              <p className="text-xs text-ink-faint">Progress</p>
              <p className="text-xl font-semibold text-ink">{progress}%</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        {isAdmin ? (
          <SalesTargetForm current={overview.monthlyTarget} />
        ) : (
          <p className="text-xs text-ink-faint">Only admins can change the target.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Sales strategy by client</h2>
        <div className="space-y-1.5">
          {(clients ?? []).map((client) => (
            <div key={client.id} className="flex items-center justify-between gap-3">
              <Link href={`/clients/${client.id}/sales`} className="text-sm text-accent underline-offset-2 hover:underline">
                {client.name}
              </Link>
              <span className="text-xs text-ink-faint">
                {client.retainer_amount ? `${formatCurrency(client.retainer_amount)}/month` : client.status}
              </span>
            </div>
          ))}
          {(clients ?? []).length === 0 && <p className="text-sm text-ink-soft">No clients visible to you yet.</p>}
        </div>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Coming later, in this same section: pipeline, forecast revenue, won/lost business and invoicing.
      </p>
    </div>
  );
}
