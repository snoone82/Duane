import type { StrategySnapshot } from "@/lib/signoff-snapshot";
import { formatDate } from "@/lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{value}</p>
    </div>
  );
}

/** Read-only render of a frozen sign-off snapshot — used on the team's
 * Outputs tab and in the portal review screen; the PDF mirrors this. */
export function SignoffSnapshotView({ snapshot }: { snapshot: StrategySnapshot }) {
  return (
    <div className="space-y-5">
      {snapshot.northStar && (
        <Section title="North Star">
          <p className="whitespace-pre-wrap text-sm font-medium text-ink">{snapshot.northStar}</p>
        </Section>
      )}

      {snapshot.vision.length > 0 && (
        <Section title="Vision">
          {snapshot.vision.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </Section>
      )}

      {snapshot.positioning.length > 0 && (
        <Section title="Positioning">
          {snapshot.positioning.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </Section>
      )}

      {snapshot.authorityPosition && (
        <Section title="Authority position">
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{snapshot.authorityPosition}</p>
        </Section>
      )}

      {snapshot.audiences.length > 0 && (
        <Section title="Audiences">
          {snapshot.audiences.map((a) => (
            <div key={a.name} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{a.name}</p>
              {a.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{a.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {snapshot.pillars.length > 0 && (
        <Section title="Content pillars">
          {snapshot.pillars.map((p) => (
            <div key={p.name} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{p.name}</p>
              {p.description && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{p.description}</p>}
              {p.keyMessages && <Field label="Key messages" value={p.keyMessages} />}
            </div>
          ))}
        </Section>
      )}

      {snapshot.coreMessages && (
        <Section title="Core messages">
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{snapshot.coreMessages}</p>
        </Section>
      )}

      {snapshot.commercialObjectives.length > 0 && (
        <Section title="Commercial objectives">
          {snapshot.commercialObjectives.map((f) => (
            <Field key={f.label} label={f.label} value={f.value} />
          ))}
        </Section>
      )}

      {snapshot.platforms.length > 0 && (
        <Section title="Platforms & direction">
          {snapshot.platforms.map((p) => (
            <div key={p.platform} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium text-ink">{p.platform}</p>
              {p.objective && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{p.objective}</p>}
              {p.postingFrequency && <p className="mt-0.5 text-xs text-ink-faint">Cadence: {p.postingFrequency}</p>}
            </div>
          ))}
        </Section>
      )}

      {snapshot.priorities.length > 0 && (
        <Section title="Initial priorities">
          <ul className="space-y-1">
            {snapshot.priorities.map((priority, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-ink-soft">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" aria-hidden />
                <span>
                  {priority.title}
                  {priority.dueDate && <span className="text-ink-faint"> — by {formatDate(priority.dueDate)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
