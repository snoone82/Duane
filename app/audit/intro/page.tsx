import { redirect } from "next/navigation";
import { getCurrentUser, getInProgressAudit } from "@/lib/audit-data";
import { AuditIntroClient } from "@/components/audit/AuditIntroClient";
import { Logo } from "@/components/ui/Logo";

const SCORING_GUIDE = [
  { range: "1–2", label: "Deeply out of alignment" },
  { range: "3–4", label: "Struggling / neglected" },
  { range: "5–6", label: "Inconsistent / needs attention" },
  { range: "7–8", label: "Strong but not fully aligned" },
  { range: "9–10", label: "Fully aligned / thriving" },
];

export default async function AuditIntroPage() {
  // No session yet is the expected, common case here — this page is often
  // the very first thing a brand new visitor's browser requests. The
  // audit (and the anonymous session behind it) isn't created until they
  // click "Begin the Audit" below.
  const user = await getCurrentUser();

  // Already mid-audit (e.g. bookmarked this page, or came back via browser
  // history) — the intro is for arriving cold, not for someone who's already
  // begun. Send them straight back to where they left off.
  if (user) {
    const inProgress = await getInProgressAudit(user.id);
    if (inProgress) redirect("/audit");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />

      <div className="flex-1">
        <p className="label-caps text-sm text-gold">Before you begin</p>
        <h1 className="mt-2 font-heading text-2xl text-ink">The Aligned Audit</h1>

        <p className="mt-4 text-base leading-snug text-ink-soft">
          The Aligned Audit helps you get honest about where you are, clear on
          who you&rsquo;re becoming, and focused on the first move that will
          create real change. The breakthrough often begins when you stop
          guessing, face your reality honestly, and give yourself permission
          to change.
        </p>

        <section className="mt-8 rounded-lg border border-border bg-paper-muted p-5">
          <h2 className="font-heading text-base text-ink">
            Score where you genuinely are today
          </h2>
          <p className="mt-2 text-sm leading-snug text-ink-soft">
            Not where you think you should be. An honest score is the most
            valuable thing you can give yourself right now — this isn&rsquo;t
            a test to pass.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-heading text-base text-ink">Scoring guide</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Each area asks you to rate how it is right now, from 1 to 10.
          </p>
          <dl className="mt-4 divide-y divide-border border-y border-border">
            {SCORING_GUIDE.map((row) => (
              <div key={row.range} className="flex items-baseline gap-4 py-3">
                <dt className="font-heading text-sm font-semibold text-gold-strong w-14 shrink-0">
                  {row.range}
                </dt>
                <dd className="text-sm text-ink-soft">{row.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mt-10">
        <AuditIntroClient />
      </div>
    </main>
  );
}
