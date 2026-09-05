import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AddMonthlyPlanButton } from "@/components/clients/AddMonthlyPlanButton";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { monthlyPlanStatusMeta } from "@/lib/status";
import { periodMonthLabel } from "@/lib/monthly-plan-format";

export const metadata = { title: "Monthly Plans" };

export default async function MonthlyPlansPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: plans }, { data: ideas }] = await Promise.all([
    supabase.from("monthly_plans").select("*").eq("client_id", id).order("period_month", { ascending: false }),
    supabase.from("content_ideas").select("monthly_plan_id").eq("client_id", id).not("monthly_plan_id", "is", null),
  ]);

  const contentCount = new Map<string, number>();
  for (const idea of ideas ?? []) {
    if (!idea.monthly_plan_id) continue;
    contentCount.set(idea.monthly_plan_id, (contentCount.get(idea.monthly_plan_id) ?? 0) + 1);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          The structured planning layer underneath the client PDF: Client Snapshot, Master Content, Platform Outputs and
          Requirements, one record per month.
        </p>
        <AddMonthlyPlanButton clientId={id} />
      </div>

      {!plans || plans.length === 0 ? (
        <EmptyState
          title="No Monthly Plans yet"
          description="Create the first one to pull a snapshot of this client's current strategy and start planning content against it."
        />
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => {
            const meta = monthlyPlanStatusMeta(plan.status);
            return (
              <Link
                key={plan.id}
                href={`/clients/${id}/plans/${plan.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <span className="text-sm font-medium text-ink">{periodMonthLabel(plan.period_month)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint">{contentCount.get(plan.id) ?? 0} Master Content</span>
                  <StatusPill label={meta.label} color={meta.color} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
