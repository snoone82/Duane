import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/data/portal";
import { StatusPill } from "@/components/ui/StatusPill";
import { MediaThumb } from "@/components/portal/MediaThumb";
import { Donut } from "@/components/dashboard/Charts";
import { actionStatusMeta, outputStatusMeta, type OutputStatus } from "@/lib/status";
import { signoffStatusMeta } from "@/lib/signoff-snapshot";
import { formatDate, formatRelativeToToday, formatDateTime, socialAccountLabel, formatCurrency } from "@/lib/format";
import { mediaPreview } from "@/lib/media";
import { getCadenceForClient, CADENCE_STAGES, cadenceClientNote } from "@/lib/data/cadence";
import { buildClientResults } from "@/lib/data/client-results";
import { cadenceLabel } from "@/lib/platform-strategy";

export const metadata = { title: "Dashboard" };

function Card({
  title,
  action,
  tone = "teal",
  children,
}: {
  title: string;
  action?: React.ReactNode;
  tone?: "teal" | "violet";
  children: React.ReactNode;
}) {
  const toneBar =
    tone === "violet" ? "linear-gradient(90deg, #8b5cf6, transparent)" : "linear-gradient(90deg, #21c9e0, transparent)";
  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-md backdrop-blur-sm">
      <div className="mb-3 h-px w-full" style={{ background: toneBar }} />
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink-soft">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex-shrink-0 text-xs font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

/** Duane's client dashboard: log in and understand the state of your
 * personal brand in 20–30 seconds — what needs you, what's happening this
 * week, where the pipeline stands, and what Aligned Media are working on. */
export default async function PortalDashboardPage() {
  const context = await getPortalContext();
  if (!context) return null;
  const { client, can, userId } = context;

  const supabase = await createClient();
  // Cadence uses the shared calculation, so the client and the Aligned Media
  // team always see the same numbers (Duane's condition for surfacing it).
  const cadence = await getCadenceForClient(supabase, context.client.id);
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [
    { data: signoffs },
    { data: ideas },
    { data: outputs },
    { data: actions },
    { data: members },
    { data: meetings },
    { data: milestones },
  ] = await Promise.all([
    supabase.from("strategy_signoffs").select("id,version,title,status,created_at,updated_at,approved_at,approved_by_name").eq("client_id", client.id).order("version", { ascending: false }),
    supabase.from("content_ideas").select("id,title,status,updated_at,target_publish_date,pillar_id").eq("client_id", client.id).order("updated_at", { ascending: false }),
    supabase
      .from("content_outputs")
      .select("id,content_id,platform,format,status,scheduled_at,published_at,target_publish_date,reach,views,engagement,likes,comments,shares,analytics_at,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url,social:social_strategies(account_name),content:content_ideas(title,media_path,media_url,media_source_url,thumbnail_path,thumbnail_url,thumbnail_source_url)")
      .eq("client_id", client.id),
    supabase.from("actions").select("*").eq("client_id", client.id).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("client_members").select("user_id,name").eq("client_id", client.id),
    supabase.from("portal_meeting_summaries").select("id,meeting_date,next_meeting_date").eq("client_id", client.id).order("meeting_date", { ascending: false }).limit(12),
    can("view_progress")
      ? supabase.from("milestones").select("id,title,milestone_date,is_highlighted").eq("client_id", client.id).order("milestone_date", { ascending: false }).limit(3)
      : Promise.resolve({ data: [] as { id: string; title: string; milestone_date: string; is_highlighted: boolean }[] }),
  ]);

  // Requirements and results (Duane, testing as Jonny). RLS does the real
  // work here: the portal policy only returns requirements that aren't
  // team-only, so a note written for us can't reach this page even by
  // accident.
  const [{ data: requirements }, { data: pillars }, { data: outcomes }] = await Promise.all([
    supabase
      .from("monthly_plan_requirements")
      .select("id,type,description,state,related_content_note,due_date")
      .eq("client_id", client.id)
      .neq("state", "done")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("brand_pillars").select("id,name").eq("client_id", client.id),
    can("view_progress")
      ? supabase.from("commercial_outcomes").select("value,outcome_date,description").eq("client_id", client.id)
      : Promise.resolve({ data: [] as { value: number | null; outcome_date: string; description: string }[] }),
  ]);

  // --- Who owns what: mine / client team / Aligned Media ---
  const memberUserIds = new Set((members ?? []).filter((m) => m.user_id).map((m) => m.user_id as string));
  const memberNames = new Set((members ?? []).map((m) => m.name.trim().toLowerCase()));
  const isClientSide = (a: { owner_user_id: string | null; owner_name: string | null }) =>
    (a.owner_user_id !== null && memberUserIds.has(a.owner_user_id)) ||
    (a.owner_user_id === null && a.owner_name !== null && memberNames.has(a.owner_name.trim().toLowerCase()));

  const allActions = actions ?? [];
  const openActions = allActions.filter((a) => a.status !== "completed");
  const myOpen = openActions.filter((a) => a.owner_user_id === userId);
  const clientOpen = openActions.filter((a) => a.owner_user_id !== userId && isClientSide(a));
  const teamOpen = openActions.filter((a) => a.owner_user_id !== userId && !isClientSide(a));
  const myOverdue = myOpen.filter((a) => a.due_date && a.due_date < today);

  // --- Pipeline buckets ---
  const allIdeas = ideas ?? [];
  const bucket = (statuses: string[]) => allIdeas.filter((i) => statuses.includes(i.status)).length;
  const pipeline = [
    { label: "Ideas", count: bucket(["idea"]) },
    { label: "In production", count: bucket(["approved_production", "in_production", "changes_requested"]) },
    { label: "Awaiting your approval", count: bucket(["ready_for_approval"]) },
    { label: "Scheduled", count: bucket(["ready_to_schedule", "scheduled"]) },
    { label: "Published", count: bucket(["published"]) },
  ];
  const awaitingApproval = bucket(["ready_for_approval"]);
  const pipelineTotal = pipeline.reduce((sum, stage) => sum + stage.count, 0);

  // --- Strategy status ---
  const latestPack = (signoffs ?? [])[0];

  // --- Needs your attention ---
  const attention: { label: string; href: string; urgent?: boolean }[] = [];
  if (latestPack?.status === "sent" && can("approve_strategy")) {
    attention.push({ label: `Strategy pack v${latestPack.version} is waiting for your approval`, href: "/portal/signoff" });
  }
  if (awaitingApproval > 0 && can("approve_content")) {
    attention.push({
      label: `${awaitingApproval} piece${awaitingApproval === 1 ? "" : "s"} of content awaiting your approval`,
      href: "/portal/content",
    });
  }
  if (myOverdue.length > 0) {
    attention.push({
      label: `${myOverdue.length} of your action${myOverdue.length === 1 ? " is" : "s are"} overdue`,
      href: "/portal/priorities",
      urgent: true,
    });
  } else if (myOpen.length > 0) {
    attention.push({ label: `${myOpen.length} open action${myOpen.length === 1 ? "" : "s"} assigned to you`, href: "/portal/priorities" });
  }

  // What the month's plan needs from the client — filming, assets,
  // decisions, confirmations. These auto-populate: nobody has to remember to
  // tell Jonny that a piece is waiting on him.
  const CLIENT_ASK_TYPES = new Set(["information", "decision_approval", "asset_upload", "filming"]);
  const clientAsks = (requirements ?? []).filter((r) => CLIENT_ASK_TYPES.has(r.type));
  for (const ask of clientAsks.slice(0, 4)) {
    attention.push({
      label: ask.description,
      href: "/portal/content",
      urgent: Boolean(ask.due_date && ask.due_date < today),
    });
  }
  if (clientAsks.length > 4) {
    attention.push({ label: `and ${clientAsks.length - 4} more we need from you this month`, href: "/portal/content" });
  }

  // --- Coming up (Duane: a feed of what's actually going out, not a
  //     seven-day window that's empty most of the time) ---
  //
  // Reads the scheduled time where there is one and the planned publish date
  // otherwise, so a month that's been dated but not yet handed to Ayrshare
  // still shows the client what's coming.
  const nowIso = new Date().toISOString();
  const comingUp = (outputs ?? [])
    .map((o) => {
      const when = o.scheduled_at ?? (o.target_publish_date ? `${o.target_publish_date}T09:00:00Z` : null);
      return { output: o, when, exact: Boolean(o.scheduled_at) };
    })
    .filter((row) => row.when !== null && row.when >= nowIso && row.output.status !== "published")
    .sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""))
    .slice(0, 6);

  const dueThisWeek = openActions.filter((a) => a.due_date && a.due_date >= today && a.due_date <= weekAhead).slice(0, 5);

  // --- Results ---
  const results = buildClientResults(
    (outputs ?? []).map((o) => ({
      status: o.status,
      published_at: o.published_at,
      analytics_at: o.analytics_at,
      reach: o.reach,
      views: o.views,
      engagement: o.engagement,
      likes: o.likes,
      comments: o.comments,
      shares: o.shares,
      content_id: o.content_id,
      platform: o.platform,
    })),
    allIdeas.map((i) => ({ id: i.id, pillar_id: i.pillar_id })),
    new Map((pillars ?? []).map((p) => [p.id, p.name])),
    outcomes ?? []
  );

  // --- Next production: what the team is making, and what it's waiting on ---
  const PRODUCTION_TYPES = new Set(["filming", "asset_upload", "other"]);
  const nextProduction = (requirements ?? []).filter((r) => PRODUCTION_TYPES.has(r.type)).slice(0, 6);
  const nextMeeting = (meetings ?? [])
    .map((m) => m.next_meeting_date)
    .filter((d): d is string => Boolean(d && d >= today))
    .sort()[0];

  // Same greeting treatment as the admin dashboard, in the workspace's own
  // timezone rather than the server's.
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date())
  );
  const greeting = londonHour < 12 ? "Good morning" : londonHour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (context.member?.name ?? client.name).split(" ")[0] || null;
  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-ink">
            {greeting}
            {firstName ? (
              <>
                , <span className="bg-gradient-to-r from-accent to-[#8b5cf6] bg-clip-text font-normal text-transparent">{firstName}</span>
              </>
            ) : null}
            .
          </h1>
          <p className="mt-1 text-sm font-light text-ink-soft">Here&rsquo;s where your personal brand stands right now.</p>
        </div>
        <p className="text-sm font-light text-ink-faint">{todayLabel}</p>
      </div>

      {attention.length > 0 && (
        <section className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Needs your attention</h2>
          <ul className="space-y-1.5">
            {attention.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`text-sm underline-offset-2 hover:underline ${item.urgent ? "font-medium text-danger" : "text-ink"}`}
                >
                  {item.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Content cadence (Duane, 1 Sep): the client's quick answer to
          "what's planned this month, and what's ready to go out?" — using
          the same calculation as the admin Content tab, never its own. */}
      {cadence.accounts.length > 0 && can("view_content") && (
        <Card
          title={`Content cadence · ${cadence.monthLabel}`}
          action={<CardLink href="/portal/content">Content →</CardLink>}
        >
          <ul className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
            {cadence.accounts.map((row) => {
              const toneClass = (t: "good" | "neutral" | "warn") =>
                t === "good" ? "text-success" : t === "warn" ? "text-amber-500" : "text-ink-soft";
              // Duane: "Below target" on the 3rd of the month is true and
              // useless. The wording follows the calendar — it only becomes
              // a warning once there's no time left to fix it.
              const clientNote = cadenceClientNote(row.status.state, row.stages);
              const note = clientNote.label;
              const bar =
                clientNote.tone === "warn" ? "bg-amber-500"
                : clientNote.tone === "good" ? "bg-success"
                : row.status.state === "untracked" ? "bg-ink-faint/40"
                : "bg-accent";
              const pct = row.status.target ? Math.min(100, Math.round((row.status.planned / row.status.target) * 100)) : 0;
              const stageBits = CADENCE_STAGES.filter((s) => row.stages[s.key] > 0);
              return (
                <li key={row.account.id}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 text-sm text-ink">{row.label}</span>
                    <span className={`text-xs tabular-nums ${toneClass(clientNote.tone)}`}>
                      {row.status.label}
                      {note && ` · ${note}`}
                    </span>
                  </div>
                  {row.status.target === null ? (
                    <p className="text-xs text-ink-faint">{cadenceLabel(row.account)}</p>
                  ) : (
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                  )}
                  {stageBits.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-faint">
                      {stageBits.map((s) => (
                        <span key={s.key}>
                          <span className="tabular-nums text-ink-soft">{row.stages[s.key]}</span> {s.label.toLowerCase()}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 border-t border-border pt-2 text-xs text-ink-faint">
            <Link href="/portal/calendar" className="text-accent underline-offset-2 hover:underline">
              See the dates on the calendar →
            </Link>
          </p>
        </Card>
      )}

      {/* Coming up — the visual feed of what's actually going out next. */}
      {can("view_content") && (
        <Card title="Coming up" action={<CardLink href="/portal/calendar">Calendar →</CardLink>}>
          {comingUp.length === 0 && dueThisWeek.length === 0 && !nextMeeting ? (
            <p className="text-sm text-ink-faint">Nothing scheduled yet — this fills up as the month is planned and dated.</p>
          ) : (
            <ul className="space-y-2.5">
              {nextMeeting && (
                <li className="flex items-center gap-3 text-sm text-ink">
                  <StatusPill label="Meeting" color="teal" />
                  <span>Your next catch-up — {formatRelativeToToday(nextMeeting)}</span>
                </li>
              )}
              {comingUp.map(({ output: o, when, exact }) => {
                const thumb = mediaPreview(o, o.content);
                const meta = outputStatusMeta(o.status as OutputStatus);
                return (
                  <li key={o.id} className="flex items-start gap-3">
                    {thumb ? (
                      <MediaThumb url={thumb.url} kind={thumb.kind} size="md" />
                    ) : (
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md border border-border bg-surface-muted text-xs text-ink-faint">
                        {o.format ? o.format.slice(0, 4) : "post"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{o.content?.title ?? "Content"}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {socialAccountLabel(o.platform, o.social?.account_name)}
                        {o.format && <span className="text-ink-faint"> · {o.format.replace(/_/g, " ")}</span>}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {when && (exact ? formatDateTime(when) : `${formatDate(when.slice(0, 10))} — time to be confirmed`)}
                      </p>
                    </div>
                    <span className="flex-none">
                      <StatusPill label={meta.label} color={meta.color} />
                    </span>
                  </li>
                );
              })}
              {dueThisWeek.map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-sm text-ink">
                  <StatusPill label="Action" color="amber" />
                  <span className="min-w-0 truncate">
                    {a.title}
                    {a.due_date && <span className="text-ink-faint"> — due {formatRelativeToToday(a.due_date)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Results — is it working? Nothing here is invented: every number is
          either measured from the networks or recorded in PBOS, and the
          card says plainly when the numbers haven't landed yet. */}
      {can("view_progress") && (
        <Card title="Results this month" action={<CardLink href="/portal/progress">Progress →</CardLink>}>
          {results.publishedThisMonth === 0 && results.measured === 0 ? (
            <p className="text-sm text-ink-faint">
              Nothing published yet this month — results appear here once your content starts going out.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
                <div>
                  <dt className="text-xs text-ink-soft">Published this month</dt>
                  <dd className="text-2xl font-light tabular-nums text-ink">{results.publishedThisMonth}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-soft">{results.reach > 0 ? "Impressions" : "Views"}</dt>
                  <dd className="text-2xl font-light tabular-nums text-ink">
                    {(results.reach || results.views).toLocaleString("en-GB")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-soft">Average engagement</dt>
                  <dd className="text-2xl font-light tabular-nums text-ink">
                    {results.engagementRate !== null ? `${results.engagementRate}%` : "—"}
                  </dd>
                  <dd className="text-xs text-ink-faint">{results.interactions.toLocaleString("en-GB")} interactions</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-soft">Sign-ups &amp; leads</dt>
                  <dd className="text-2xl font-light tabular-nums text-ink">{results.outcomesThisMonth}</dd>
                  {results.outcomeValue > 0 && (
                    <dd className="text-xs text-ink-faint">{formatCurrency(results.outcomeValue)} recorded</dd>
                  )}
                </div>
              </dl>
              {results.topPillar && (
                <p className="mt-3 border-t border-border pt-2 text-sm text-ink">
                  <span className="text-ink-soft">Best-performing theme: </span>
                  {results.topPillar.name}
                  <span className="text-ink-faint">
                    {" "}
                    — {results.topPillar.interactions.toLocaleString("en-GB")} interactions across {results.topPillar.posts} post
                    {results.topPillar.posts === 1 ? "" : "s"}
                  </span>
                </p>
              )}
              {results.awaitingMeasurement > 0 && (
                <p className="mt-2 text-xs text-ink-faint">
                  {results.awaitingMeasurement} published post{results.awaitingMeasurement === 1 ? "" : "s"} not measured yet — the
                  networks report back a day or two after publishing.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Content pipeline" tone="violet" action={can("view_content") ? <CardLink href="/portal/content">Content →</CardLink> : undefined}>
          {pipelineTotal > 0 ? (
            <Donut
              centreLabel="in play"
              segments={[
                { label: "Ideas", value: pipeline[0]?.count ?? 0, color: "#3987e5" },
                { label: "In production", value: pipeline[1]?.count ?? 0, color: "#d95926" },
                { label: "Awaiting your approval", value: pipeline[2]?.count ?? 0, color: "#199e70" },
                { label: "Scheduled", value: pipeline[3]?.count ?? 0, color: "#c98500" },
                { label: "Published", value: pipeline[4]?.count ?? 0, color: "#d55181" },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-faint">Nothing in the pipeline yet.</p>
          )}
        </Card>

        <Card title="Actions" action={<CardLink href="/portal/priorities">All actions →</CardLink>}>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-ink-soft">Assigned to you</span>
              <span className={`tabular-nums ${myOverdue.length > 0 ? "font-medium text-danger" : "text-ink"}`}>
                {myOpen.length}
                {myOverdue.length > 0 ? ` (${myOverdue.length} overdue)` : ""}
              </span>
            </li>
            {clientOpen.length > 0 && (
              <li className="flex items-center justify-between">
                <span className="text-ink-soft">With your team</span>
                <span className="tabular-nums text-ink">{clientOpen.length}</span>
              </li>
            )}
            <li className="flex items-center justify-between">
              <span className="text-ink-soft">Aligned Media working on</span>
              <span className="tabular-nums text-ink">{teamOpen.length}</span>
            </li>
          </ul>
          {teamOpen.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-border pt-2">
              {teamOpen.slice(0, 3).map((a) => {
                const meta = actionStatusMeta(a.status);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink-soft">{a.title}</span>
                    <StatusPill label={meta.label} color={meta.color} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {(nextProduction.length > 0 || (milestones ?? []).length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Next production — replaces the old activity log (Duane: the
              weakest widget). What's being made, rather than what happened. */}
          {nextProduction.length > 0 && (
            <Card title="Next production">
              <ul className="space-y-2">
                {nextProduction.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="text-ink">{item.description}</span>
                    <span className="block text-xs text-ink-faint">
                      {item.related_content_note && <span>{item.related_content_note}</span>}
                      {item.related_content_note && item.due_date && " · "}
                      {item.due_date && `due ${formatRelativeToToday(item.due_date)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-border pt-2 text-xs text-ink-faint">
                Writing, filming, editing and design for this month&rsquo;s content.
              </p>
            </Card>
          )}
          {(milestones ?? []).length > 0 && (
            <Card title="Progress" action={<CardLink href="/portal/progress">Timeline →</CardLink>}>
              <ul className="space-y-1.5">
                {(milestones ?? []).map((m) => (
                  <li key={m.id} className="text-sm text-ink">
                    {m.title}
                    <span className="block text-xs text-ink-faint">{formatDate(m.milestone_date)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Card title="Your strategy" action={can("view_strategy") ? <CardLink href="/portal/signoff">Sign-off →</CardLink> : undefined}>
        {latestPack ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-ink">
                {latestPack.title} — v{latestPack.version}
              </span>
              <StatusPill label={signoffStatusMeta(latestPack.status).label} color={signoffStatusMeta(latestPack.status).color} />
            </div>
            {latestPack.status === "approved" && (
              <p className="text-xs text-ink-faint">
                Approved {formatDate(latestPack.approved_at?.slice(0, 10))} — this is your agreed baseline.
              </p>
            )}
            {latestPack.status === "sent" && <p className="text-xs text-ink-faint">Waiting for your review and approval.</p>}
            {latestPack.status === "changes_requested" && (
              <p className="text-xs text-ink-faint">You asked for changes — the team is updating it.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">Your first strategy pack is being prepared.</p>
        )}
        {can("view_strategy") && (
          <p className="mt-2 text-xs">
            <Link href="/portal/strategy" className="text-accent underline-offset-2 hover:underline">
              View the live strategy →
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}
