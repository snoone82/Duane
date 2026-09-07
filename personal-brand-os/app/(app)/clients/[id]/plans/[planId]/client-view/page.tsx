import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientView } from "@/lib/actions/client-view";
import { ApproveMonthPanel } from "@/components/clients/ApproveMonthPanel";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Client View" };

/**
 * The month as the client sees it.
 *
 * Deliberately not called "Stage 3" anywhere (Duane): Stages 1 and 2 are
 * actions you run, this is a view you open as often as you like — before
 * dates, after dates, after comments. Everything on it is read from stored
 * records via the same export the Structured Plan Export uses. Nothing is
 * summarised or rewritten here.
 */
export default async function ClientViewPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await params;
  const result = await getClientView(id, planId);
  if (!result.ok) notFound();
  const { view, approval } = result.data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={`/clients/${id}/plans/${planId}`} className="text-xs text-accent underline-offset-2 hover:underline">
          ← Back to the plan
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink">
            {view.clientName} — {view.periodLabel}
          </h1>
          {approval.approvedAt && !approval.changedSinceApproval && <StatusPill label="Approved" color="green" />}
          {approval.changedSinceApproval && (
            <span title="A client-visible field — title, hook, summary, CTA, platform, format or publish date — has changed since this month was signed off. Internal production notes don't affect this.">
              <StatusPill label="Changed since approval" color="amber" />
            </span>
          )}
          {!view.datesAssigned && <StatusPill label="Dates not assigned" color="slate" />}
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          {view.datesAssigned
            ? "The full monthly sign-off view — content and schedule."
            : "Content review — publish dates haven't been assigned yet, so this is the plan without the schedule."}{" "}
          {view.totals.items} pieces · {view.totals.outputs} posts.
        </p>
      </div>

      {view.primaryObjective && (
        <section className="rounded-lg border border-line bg-surface-muted p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">This month&rsquo;s objective</h2>
          <p className="mt-1 text-sm text-ink">{view.primaryObjective}</p>
        </section>
      )}

      <ApproveMonthPanel
        clientId={id}
        planId={planId}
        approvedAt={approval.approvedAt}
        approvedRevision={approval.approvedRevision}
        changedSinceApproval={approval.changedSinceApproval}
        canApprove={approval.canApprove}
        blockedReason={approval.blockedReason}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">The content</h2>
        {view.items.map((item) => (
          <article key={item.sequence} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              {item.publishDate && <span className="text-xs text-ink-soft">{formatDate(item.publishDate)}</span>}
            </div>
            {item.summary && <p className="mt-1.5 text-sm text-ink">{item.summary}</p>}
            {item.hook && <p className="mt-2 border-l-2 border-accent/40 pl-3 text-sm italic text-ink-soft">{item.hook}</p>}

            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              {item.purpose && (
                <div>
                  <dt className="inline text-ink-faint">Why we&rsquo;re saying it: </dt>
                  <dd className="inline text-ink-soft">{item.purpose}</dd>
                </div>
              )}
              {item.whyNow && (
                <div>
                  <dt className="inline text-ink-faint">Why now: </dt>
                  <dd className="inline text-ink-soft">{item.whyNow}</dd>
                </div>
              )}
              {item.pillar && (
                <div>
                  <dt className="inline text-ink-faint">Theme: </dt>
                  <dd className="inline text-ink-soft">{item.pillar}</dd>
                </div>
              )}
              {item.audience && (
                <div>
                  <dt className="inline text-ink-faint">For: </dt>
                  <dd className="inline text-ink-soft">{item.audience}</dd>
                </div>
              )}
              {item.cta && (
                <div className="sm:col-span-2">
                  <dt className="inline text-ink-faint">What we want people to do: </dt>
                  <dd className="inline text-ink-soft">
                    {item.cta}
                    {item.ctaDestination && <span className="text-ink-faint"> → {item.ctaDestination}</span>}
                  </dd>
                </div>
              )}
            </dl>

            {item.outputs.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {item.outputs.map((output, index) => (
                  <li
                    key={`${output.account}-${output.format}-${index}`}
                    className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-soft"
                  >
                    {output.account} · {output.format}
                    {output.publishDate && <span className="text-ink-faint"> · {formatDate(output.publishDate)}</span>}
                  </li>
                ))}
              </ul>
            )}

            {item.weNeedFromYou.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <p className="text-xs font-semibold text-ink">We need this from you</p>
                <ul className="mt-1 space-y-0.5">
                  {item.weNeedFromYou.map((ask) => (
                    <li key={ask} className="text-xs text-ink-soft">
                      {ask}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </section>

      {view.clientRequirements.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">What we need from you this month</h2>
          <ul className="space-y-1.5">
            {view.clientRequirements.map((requirement) => (
              <li key={requirement.description} className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink">
                {requirement.description}
                {requirement.relatedTo && <span className="block text-xs text-ink-faint">For: {requirement.relatedTo}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
