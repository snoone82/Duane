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
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
            {count}
          </span>
        )}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}
