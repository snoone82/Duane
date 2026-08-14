import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCalendarItems, CALENDAR_TYPE_META, type CalendarItem } from "@/lib/data/calendar";
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

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthRaw } = await searchParams;
  const now = new Date();
  const match = monthRaw?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Math.min(12, Math.max(1, Number(match[2]))) : now.getMonth() + 1;

  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${year}-${pad(month)}-01`;
  const to = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const supabase = await createClient();
  const items = await getCalendarItems(supabase, from, to);
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

  const prev = month === 1 ? monthParam(year - 1, 12) : monthParam(year, month - 1);
  const next = month === 12 ? monthParam(year + 1, 1) : monthParam(year, month + 1);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">
            {MONTHS[month - 1]} {year}
          </h1>
          <p className="text-sm text-ink-soft">Every dated commitment across every client — meetings, deadlines, bookings and milestones.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?month=${prev}`} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink" aria-label="Previous month">
            ←
          </Link>
          <Link href="/calendar" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink">
            Today
          </Link>
          <Link href={`/calendar?month=${next}`} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink" aria-label="Next month">
            →
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        {Object.entries(CALENDAR_TYPE_META).map(([key, meta]) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <span className={`h-2.5 w-2.5 rounded-full ${chipClass[meta.color]}`} aria-hidden />
            {meta.label}
          </span>
        ))}
      </div>

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
                <span
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-accent font-semibold text-accent-ink" : "text-ink-soft"
                  }`}
                >
                  {day}
                </span>
                <div className="space-y-1">
                  {shown.map((item, j) => {
                    const meta = CALENDAR_TYPE_META[item.type];
                    return (
                      <Link
                        key={`${dateStr}-${j}`}
                        href={`/clients/${item.clientId}/${item.tab}`}
                        title={`${item.label} — ${item.clientName}`}
                        className={`block truncate rounded px-1.5 py-0.5 text-xs leading-5 hover:opacity-80 ${chipClass[meta.color]}`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  {extra > 0 && <span className="block px-1.5 text-xs text-ink-faint">+{extra} more</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
