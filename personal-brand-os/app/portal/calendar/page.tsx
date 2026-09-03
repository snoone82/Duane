import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { formatDate, socialAccountLabel } from "@/lib/format";
import { mediaPreview, type MediaPreview } from "@/lib/media";
import type { TagColor } from "@/lib/status";

export const metadata = { title: "Calendar" };

type ItemType = "content" | "action" | "meeting";

interface PortalCalendarItem {
  date: string; // YYYY-MM-DD
  time: string | null;
  type: ItemType;
  label: string;
  platform: string | null;
  thumb: MediaPreview | null;
  href: string | null;
  color: TagColor;
  overdue?: boolean;
}

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "content", label: "Content" },
  { key: "actions", label: "Actions" },
  { key: "meetings", label: "Meetings" },
];

// Same tag palette the admin calendar uses — one visual language.
const chipColor: Record<TagColor, string> = {
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

/** Duane's client calendar: one combined view of content, actions and
 * meetings — "what is happening with my brand this week / this month?" —
 * with type and platform filters and thumbnails on content. Month grid on
 * larger screens, agenda list on phones. */
export default async function PortalCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; f?: string; p?: string }>;
}) {
  const context = await getPortalContext();
  if (!context) return null;
  const { client, can } = context;

  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const month = /^\d{4}-\d{2}$/.test(params.m ?? "") ? (params.m as string) : today.slice(0, 7);
  const filter = TYPE_FILTERS.some((f) => f.key === params.f) ? (params.f as string) : "all";
  const platformFilter = (params.p ?? "").trim();

  const [yearStr, monthStr] = month.split("-") as [string, string];
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  const fromTs = `${from}T00:00:00Z`;
  const toTs = `${to}T23:59:59Z`;

  const prev = new Date(Date.UTC(year, monthIndex - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString().slice(0, 7);
  const monthLabel = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const supabase = await createClient();
  const [{ data: scheduled }, { data: publishedOut }, { data: contentDue }, { data: actions }, { data: meetings }] =
    await Promise.all([
      can("view_content")
        ? supabase
            .from("content_outputs")
            .select("id,content_id,platform,scheduled_at,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url,social:social_strategies(account_name),content:content_ideas(title,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url)")
            .eq("client_id", client.id)
            .eq("status", "scheduled")
            .not("scheduled_at", "is", null)
            .gte("scheduled_at", fromTs)
            .lte("scheduled_at", toTs)
        : Promise.resolve({ data: [] }),
      can("view_content")
        ? supabase
            .from("content_outputs")
            .select("id,content_id,platform,published_at,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url,social:social_strategies(account_name),content:content_ideas(title,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url)")
            .eq("client_id", client.id)
            .eq("status", "published")
            .not("published_at", "is", null)
            .gte("published_at", fromTs)
            .lte("published_at", toTs)
        : Promise.resolve({ data: [] }),
      can("view_content")
        ? supabase
            .from("content_ideas")
            .select("id,title,due_date,status")
            .eq("client_id", client.id)
            .not("due_date", "is", null)
            .not("status", "in", "(published,scheduled)")
            .gte("due_date", from)
            .lte("due_date", to)
        : Promise.resolve({ data: [] }),
      supabase
        .from("actions")
        .select("id,title,due_date,status,content_id")
        .eq("client_id", client.id)
        .neq("status", "completed")
        .not("due_date", "is", null)
        .gte("due_date", from)
        .lte("due_date", to),
      supabase
        .from("portal_meeting_summaries")
        .select("id,meeting_date,next_meeting_date,meeting_type")
        .eq("client_id", client.id),
    ]);

  const items: PortalCalendarItem[] = [];
  type OutputRow = {
    id: string;
    content_id: string;
    platform: string;
    scheduled_at?: string | null;
    published_at?: string | null;
    media_path: string | null;
    media_url: string | null;
    media_source_url: string;
    thumbnail_path: string | null;
    thumbnail_url: string | null;
    thumbnail_source_url: string;
    social: { account_name: string } | null;
    content: {
      title: string;
      media_path: string | null;
      media_url: string | null;
      media_source_url: string;
      thumbnail_path: string | null;
      thumbnail_url: string | null;
      thumbnail_source_url: string;
    } | null;
  };
  for (const o of (scheduled ?? []) as OutputRow[]) {
    const when = o.scheduled_at as string;
    items.push({
      date: when.slice(0, 10),
      time: when.slice(11, 16),
      type: "content",
      label: `${o.content?.title ?? "Content"} · ${socialAccountLabel(o.platform, o.social?.account_name)}`,
      platform: o.platform,
      thumb: mediaPreview(o, o.content),
      href: `/portal/content#idea-${o.content_id}`,
      color: "orange",
    });
  }
  for (const o of (publishedOut ?? []) as OutputRow[]) {
    const when = o.published_at as string;
    items.push({
      date: when.slice(0, 10),
      time: when.slice(11, 16),
      type: "content",
      label: `Published: ${o.content?.title ?? "Content"} · ${socialAccountLabel(o.platform, o.social?.account_name)}`,
      platform: o.platform,
      thumb: mediaPreview(o, o.content),
      href: `/portal/content#idea-${o.content_id}`,
      color: "green",
    });
  }
  for (const i of contentDue ?? []) {
    items.push({
      date: i.due_date as string,
      time: null,
      type: "content",
      label: `Due: ${i.title}`,
      platform: null,
      thumb: null,
      href: `/portal/content#idea-${i.id}`,
      color: "purple",
    });
  }
  for (const a of actions ?? []) {
    items.push({
      date: a.due_date as string,
      time: null,
      type: "action",
      label: a.title,
      platform: null,
      thumb: null,
      href: "/portal/priorities",
      color: "amber",
      overdue: (a.due_date as string) < today,
    });
  }
  for (const m of meetings ?? []) {
    for (const [when, label] of [
      [m.meeting_date, m.meeting_type || "Meeting"],
      [m.next_meeting_date, "Upcoming meeting"],
    ] as [string | null, string][]) {
      if (when && when >= from && when <= to) {
        items.push({ date: when, time: null, type: "meeting", label, platform: null, thumb: null, href: null, color: "teal" });
      }
    }
  }

  const platforms = [...new Set(items.map((i) => i.platform).filter((p): p is string => Boolean(p)))].sort();

  const filtered = items
    .filter((item) => {
      if (filter === "content" && item.type !== "content") return false;
      if (filter === "actions" && item.type !== "action") return false;
      if (filter === "meetings" && item.type !== "meeting") return false;
      if (platformFilter && item.platform !== platformFilter) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  const byDay = new Map<string, PortalCalendarItem[]>();
  for (const item of filtered) {
    const list = byDay.get(item.date) ?? [];
    list.push(item);
    byDay.set(item.date, list);
  }

  const link = (m: string, f: string, p: string) =>
    `/portal/calendar?m=${m}${f !== "all" ? `&f=${f}` : ""}${p ? `&p=${encodeURIComponent(p)}` : ""}`;

  // Monday-first grid.
  const firstWeekday = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ItemChip = ({ item }: { item: PortalCalendarItem }) => {
    const body = (
      <span className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] leading-tight ${chipColor[item.color]} ${item.overdue ? "ring-1 ring-danger/60" : ""}`}>
        {item.thumb && <MediaThumb url={item.thumb.url} kind={item.thumb.kind} size="sm" />}
        <span className="min-w-0 truncate">{item.time ? `${item.time} ` : ""}{item.label}</span>
      </span>
    );
    return item.href ? (
      <Link href={item.href} className="block hover:opacity-80">
        {body}
      </Link>
    ) : (
      body
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-ink">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <Link href={link(prev, filter, platformFilter)} className="rounded-md border border-border px-2 py-1 text-xs text-ink-soft hover:bg-surface-muted">
            ← {""}Prev
          </Link>
          <Link href={link(today.slice(0, 7), filter, platformFilter)} className="rounded-md border border-border px-2 py-1 text-xs text-ink-soft hover:bg-surface-muted">
            Today
          </Link>
          <Link href={link(next, filter, platformFilter)} className="rounded-md border border-border px-2 py-1 text-xs text-ink-soft hover:bg-surface-muted">
            Next →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={link(month, f.key, platformFilter)}
            className={`rounded-full px-2.5 py-1 text-xs ${filter === f.key ? "bg-accent-soft font-medium text-accent-strong" : "border border-border text-ink-soft hover:bg-surface-muted"}`}
          >
            {f.label}
          </Link>
        ))}
        {platforms.length > 1 && <span className="mx-1 text-ink-faint">·</span>}
        {platforms.length > 1 &&
          platforms.map((p) => (
            <Link
              key={p}
              href={link(month, filter, platformFilter === p ? "" : p)}
              className={`rounded-full px-2.5 py-1 text-xs ${platformFilter === p ? "bg-accent-soft font-medium text-accent-strong" : "border border-border text-ink-soft hover:bg-surface-muted"}`}
            >
              {p}
            </Link>
          ))}
      </div>

      {/* Month grid (tablet up) */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-center text-xs text-ink-soft">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, index) => (
            <div
              key={index}
              className={`min-h-[92px] border-b border-r border-border p-1 [&:nth-child(7n)]:border-r-0 ${date === today ? "bg-accent/5" : "bg-surface"}`}
            >
              {date && (
                <>
                  <p className={`mb-1 text-right text-xs ${date === today ? "font-semibold text-accent-strong" : "text-ink-faint"}`}>
                    {Number(date.slice(8, 10))}
                  </p>
                  <div className="space-y-0.5">
                    {(byDay.get(date) ?? []).map((item, i) => (
                      <ItemChip key={i} item={item} />
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Agenda list (phones) */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-ink-faint">Nothing in {monthLabel} with these filters.</p>
        ) : (
          [...byDay.entries()].map(([date, dayItems]) => (
            <div key={date} className="rounded-lg border border-border bg-surface p-3">
              <p className={`mb-1.5 text-xs font-semibold ${date === today ? "text-accent-strong" : "text-ink"}`}>
                {formatDate(date)}
                {date === today ? " · Today" : ""}
              </p>
              <div className="space-y-1">
                {dayItems.map((item, i) => (
                  <ItemChip key={i} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
