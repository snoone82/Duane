"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Input";
import { CALENDAR_TYPE_META, type CalendarItemType } from "@/lib/data/calendar";
import type { TagColor } from "@/lib/status";

const chipDot: Record<TagColor, string> = {
  slate: "bg-[--tag-slate-bg]",
  blue: "bg-[--tag-blue-bg]",
  cyan: "bg-[--tag-cyan-bg]",
  teal: "bg-[--tag-teal-bg]",
  green: "bg-[--tag-green-bg]",
  amber: "bg-[--tag-amber-bg]",
  orange: "bg-[--tag-orange-bg]",
  purple: "bg-[--tag-purple-bg]",
  pink: "bg-[--tag-pink-bg]",
  red: "bg-[--tag-red-bg]",
};

export function CalendarFilters({
  clients,
  team,
  activeClient,
  activeOwner,
  activeTypes,
  overdueOnly,
  view,
}: {
  clients: { id: string; name: string }[];
  team: { id: string; name: string }[];
  activeClient: string;
  activeOwner: string;
  activeTypes: CalendarItemType[];
  overdueOnly: boolean;
  view: "month" | "list";
}) {
  const router = useRouter();
  const params = useSearchParams();

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/calendar?${next.toString()}`);
  }

  function toggleType(type: CalendarItemType) {
    const all = Object.keys(CALENDAR_TYPE_META) as CalendarItemType[];
    const current = activeTypes.length > 0 ? activeTypes : all;
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    // Everything selected = no filter in the URL.
    update({ types: next.length === all.length || next.length === 0 ? "" : next.join(",") });
  }

  const allActive = activeTypes.length === 0;

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by client"
          value={activeClient}
          onChange={(e) => update({ client: e.target.value })}
          className="w-44"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter actions by owner"
          value={activeOwner}
          onChange={(e) => update({ owner: e.target.value })}
          className="w-44"
        >
          <option value="">Any owner</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              Owner: {m.name}
            </option>
          ))}
        </Select>
        <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Calendar view">
          {(["month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ view: v === "month" ? "" : v })}
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

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Show only">
        {(Object.entries(CALENDAR_TYPE_META) as [CalendarItemType, { label: string; color: TagColor }][]).map(
          ([type, meta]) => {
            const active = allActive || activeTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-border bg-surface text-ink"
                    : "border-transparent bg-surface-muted/50 text-ink-faint line-through"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${chipDot[meta.color]}`} aria-hidden />
                {meta.label}
              </button>
            );
          }
        )}
        <button
          type="button"
          onClick={() => update({ overdue: overdueOnly ? "" : "1" })}
          aria-pressed={overdueOnly}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            overdueOnly ? "border-danger bg-danger-bg text-danger" : "border-border bg-surface text-ink-soft hover:text-ink"
          }`}
        >
          <span className="h-2 w-2 rounded-full ring-1 ring-danger" aria-hidden />
          Overdue only
        </button>
      </div>
    </div>
  );
}
