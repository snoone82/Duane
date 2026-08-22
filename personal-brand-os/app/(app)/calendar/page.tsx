import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCalendarItems, CALENDAR_TYPE_META, type CalendarItem } from "@/lib/data/calendar";
import { CalendarFilters } from "@/components/calendar/CalendarFilters";
import { DraggableOutputChip, DroppableDay, type TrayOutput } from "@/components/calendar/CalendarDnD";
import { getAllTeamMembers } from "@/lib/data/client";
import { socialAccountLabel } from "@/lib/format";
import type { TagColor } from "@/lib/status";

export const metadata = { title: "Calendar" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const chipClass: Record<TagColor, string> = {
  slate: "bg-[--tag-slate-bg] text-[--tag-slate-text]",
  blue: "bg-[--tag-blue-bg] text-[--tag-blue-text]",
  cyan: "bg-[--tag-cyan-bg] text-[--tag-cyan-text]",
  teal: "bg-[--tag-teal-bg] text-[--tag-teal-text]",
  green: "bg-[--tag-green-bg] text-[--tag-green-text]",
  amber: "bg-[--tag-amber-bg] text-[--tag-amber-text]",
  orange: "bg-[--tag-orange-bg] text-[--tag-orange-text]",
  purple: "bg-[--tag-purple-bg] text-[--tag-purple-text]",
  pink: "bg-[--tag-pink-bg] text-[--tag-pink-text]",
  red: "bg-[--tag-red-bg] text-[--tag-red-text]",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function monthParam(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

function ItemChip({ item }: { item: CalendarItem }) {
  const meta = CALENDAR_TYPE_META[item.type];
  return (
    <Link
      href={`/clients/${item.clientId}/${item.tab}`}
      title={`${item.label} — ${item.clientName}${item.overdue ? " (overdue)" : ""}`}
      className={`block truncate rounded px-1.5 py-0.5 text-xs leading-5 hover:opacity-80 ${chipClass[meta.color]} ${
        item.overdue ? "ring-1 ring-danger" : ""
      }`}
    >
      {item.time && <span className="mr-1 opacity-70">{item.time}</span>}
      {item.label}
    </Link>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; client?: string; view?: string; types?: string; owner?: string; overdue?: string }>;
}) {
  const { month: monthRaw, client: clientFilter, view: viewRaw, types: typesRaw, owner: ownerFilter, overdue: overdueRaw } = await searchParams;
  const view: "month" | "list" = viewRaw === "list" ? "list" : "month";
  const activeTypes = (typesRaw ?? "")
    .split(",")
    .filter((t): t is CalendarItem["type"] => t in CALENDAR_TYPE_META);
  const overdueOnly = overdueRaw === "1";
  const now = new Date();
  const match = monthRaw?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Math.min(12, Math.max(1, Number(match[2]))) : now.getMonth() + 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const supabase = await createClient();
  let trayQuery = supabase
    .from("content_outputs")
    .select("id,client_id,platform,status,content:content_ideas!inner(title,status),social:social_strategies(account_name)")
    .eq("status", "pending")
    .in("content.status", ["ready_to_schedule", "scheduled"]);
  if (clientFilter) trayQuery = trayQuery.eq("client_id", clientFilter);

  const [allItems, { data: clientRows }, { data: trayRows }, team] = await Promise.all([
    getCalendarItems(supabase, from, to, clientFilter || undefined),
    supabase.from("clients").select("id,name").order("name"),
    trayQuery,
    getAllTeamMembers(supabase),
  ]);

  // Duane's accountability filters: item-type toggles, overdue-only, and
  // owner (applies to items that carry an owner — actions).
  const items = allItems.filter((item) => {
    if (activeTypes.length > 0 && !activeTypes.includes(item.type)) return false;
    if (overdueOnly && !item.overdue) return false;
    if (ownerFilter && item.type === "action" && item.ownerUserId !== ownerFilter) return false;
    return true;
  });
  const clientNames = new Map((clientRows ?? []).map((c) => [c.id, c.name]));
  const tray: TrayOutput[] = (trayRows ?? []).map((o) => ({
    outputId: o.id,
    clientId: o.client_id,
    clientName: clientNames.get(o.client_id) ?? "Unknown client",
    title: o.content?.title ?? "Content",
    platform: socialAccountLabel(o.platform, o.social?.account_name),
  }));
  const byDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }

  // Monday-first grid.
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const keepParams = (m: string) => {
    const qs = new URLSearchParams({ month: m });
    if (clientFilter) qs.set("client", clientFilter);
    if (view === "list") qs.set("view", "list");
    if (typesRaw) qs.set("types", typesRaw);
    if (ownerFilter) qs.set("owner", ownerFilter);
    if (overdueOnly) qs.set("overdue", "1");
    return `/calendar?${qs.toString()}`;
  };
  const prev = month === 1 ? monthParam(year - 1, 12) : monthParam(year, month - 1);
  const next = month === 12 ? monthParam(year + 1, 1) : monthParam(year, month + 1);

  const sortedDates = [...byDate.keys()].sort();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            {MONTHS[month - 1]} {year}
          </h1>
          <p className="text-sm text-ink-soft">
            Every dated commitment — meetings, deadlines, bookings, milestones and the content publishing schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarFilters
            clients={clientRows ?? []}
            team={team.map((m) => ({ id: m.id, name: m.name }))}
            activeClient={clientFilter ?? ""}
            activeOwner={ownerFilter ?? ""}
            activeTypes={activeTypes}
            overdueOnly={overdueOnly}
            view={view}
          />
          <div className="flex items-center gap-1">
            <Link href={keepParams(prev)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink" aria-label="Previous month">
              ←
            </Link>
            <Link href={keepParams(monthParam(now.getFullYear(), now.getMonth() + 1))} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink">
              Today
            </Link>
            <Link href={keepParams(next)} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink" aria-label="Next month">
              →
            </Link>
          </div>
        </div>
      </div>

      {view === "month" && tray.length > 0 && (
        <div className="mb-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Ready to schedule · {tray.length} — drag onto a day (schedules at 09:00; fine-tune from the Content tab)
          </p>
          <div className="flex flex-wrap gap-2">
            {tray.map((output) => (
              <DraggableOutputChip key={output.outputId} output={output} />
            ))}
          </div>
        </div>
      )}

      {view === "list" ? (
        <div className="space-y-4">
          {sortedDates.length === 0 && (
            <p className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-ink-soft">
              Nothing scheduled this month{clientFilter ? " for this client" : ""}.
            </p>
          )}
          {sortedDates.map((date) => {
            const dayItems = byDate.get(date)!;
            const d = new Date(`${date}T00:00:00`);
            const isToday = date === todayStr;
            return (
              <div key={date} className="rounded-lg border border-border bg-surface">
                <div className={`border-b border-border px-4 py-2 text-sm font-medium ${isToday ? "text-accent" : "text-ink"}`}>
                  {d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                  {isToday && " · Today"}
                </div>
                <div className="space-y-1 p-3">
                  {dayItems.map((item, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <ItemChip item={item} />
                      </div>
                      <span className="flex-shrink-0 text-xs text-ink-faint">{item.clientName}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-medium text-ink-soft">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`b${i}`} className="min-h-24 border-b border-r border-border bg-bg/40 [&:nth-child(7n)]:border-r-0" />;
              }
              const dateStr = `${year}-${pad(month)}-${pad(day)}`;
              const dayItems = byDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const shown = dayItems.slice(0, 3);
              const extra = dayItems.length - shown.length;
              return (
                <div key={dateStr} className="min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0">
                  <DroppableDay date={dateStr}>
                    <span
                      className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-accent font-semibold text-accent-ink" : "text-ink-soft"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="space-y-1">
                      {shown.map((item, j) => (
                        <ItemChip key={`${dateStr}-${j}`} item={item} />
                      ))}
                      {extra > 0 && <span className="block px-1.5 text-xs text-ink-faint">+{extra} more</span>}
                    </div>
                  </DroppableDay>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
