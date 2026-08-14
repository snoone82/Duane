/**
 * Thin table primitives — consistent density/borders, and the overflow-x
 * container that keeps a wide table from ever forcing the page to scroll
 * horizontally. At 1280px every table in the app is column-budgeted to fit
 * without needing this to kick in, but it's a safety net rather than a
 * crutch.
 */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-surface-muted text-xs text-ink-soft">{children}</thead>;
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`whitespace-nowrap px-3 py-2 text-left font-medium ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

export function Tr({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <tr className={`border-t border-border first:border-t-0 ${className}`}>{children}</tr>;
}
