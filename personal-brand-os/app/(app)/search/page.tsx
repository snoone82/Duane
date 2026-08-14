import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Search" };

const KIND_LABELS: Record<string, string> = {
  client: "Clients",
  content_idea: "Content ideas",
  authority: "Authority opportunities",
  consultation: "Consultations",
  action: "Actions",
  pillar: "Pillars",
};

const KIND_ORDER = ["client", "content_idea", "authority", "consultation", "action", "pillar"];

function tabForKind(kind: string): string {
  switch (kind) {
    case "client":
      return "overview";
    case "content_idea":
    case "pillar":
      return "content";
    case "authority":
      return "authority";
    case "consultation":
      return "consultations";
    case "action":
      return "actions";
    default:
      return "overview";
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();

  type SearchResult = { kind: string; id: string; client_id: string; title: string; body: string | null; updated_at: string };
  let results: SearchResult[] = [];

  if (query) {
    const escaped = query.replace(/[%,]/g, "");
    const { data } = await supabase
      .from("global_search")
      .select("*")
      .or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`)
      .order("updated_at", { ascending: false })
      .limit(200);
    // The view's columns type as nullable (Postgres/PostgREST can't prove
    // non-null through a view over a UNION ALL), even though every source
    // column feeding kind/id/client_id/title/updated_at is NOT NULL — see
    // the migration. Filter defensively rather than assert past it.
    results = (data ?? []).filter(
      (row): row is SearchResult =>
        row.kind !== null && row.id !== null && row.client_id !== null && row.title !== null && row.updated_at !== null
    );
  }

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABELS[kind] ?? kind,
    items: results.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-ink">Search</h1>
      <form action="/search" role="search" className="mb-6">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Search clients, content, authority, consultations, actions, pillars…"
          className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent"
        />
      </form>

      {!query ? (
        <p className="text-sm text-ink-faint">Type something above, or press &ldquo;/&rdquo; from anywhere in the app.</p>
      ) : groups.length === 0 ? (
        <EmptyState title="No results" description={`Nothing matched "${query}".`} />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.kind}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {group.label} · {group.items.length}
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {group.items.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link
                      href={`/clients/${item.client_id}/${tabForKind(item.kind)}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{item.title}</span>
                        {item.body && <span className="block truncate text-xs text-ink-faint">{item.body}</span>}
                      </span>
                      <span className="flex-shrink-0 text-xs text-ink-faint">{formatDateTime(item.updated_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
