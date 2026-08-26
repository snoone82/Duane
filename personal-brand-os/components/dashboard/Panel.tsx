/** Dashboard panel, Deep Focus edition: glass card with a soft glow, an
 * uppercase tracked label, and the count as a quiet chip. */
export function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface shadow-md backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
        {count !== undefined && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              count > 0 ? "bg-accent-soft text-accent-strong" : "bg-surface-muted text-ink-faint"
            }`}
          >
            {count}
          </span>
        )}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}
