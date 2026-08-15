/** Read-only label + value pair for portal pages — the portal never edits. */
export function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  const text = (value ?? "").trim();
  if (!text) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">{text}</p>
    </div>
  );
}

export function PortalCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      {title && <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
