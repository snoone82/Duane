"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Input";

export function CalendarFilters({
  clients,
  activeClient,
  view,
}: {
  clients: { id: string; name: string }[];
  activeClient: string;
  view: "month" | "list";
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/calendar?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Filter by client"
        value={activeClient}
        onChange={(e) => update("client", e.target.value)}
        className="w-44"
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Calendar view">
        {(["month", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => update("view", v === "month" ? "" : v)}
            className={`px-3 py-1.5 text-sm capitalize ${
              view === v ? "bg-accent text-accent-ink" : "bg-surface text-ink-soft hover:text-ink"
            }`}
            aria-pressed={view === v}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
