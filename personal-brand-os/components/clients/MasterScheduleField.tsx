"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { setMasterSchedule, scheduleAllOutputs } from "@/lib/actions/content";
import { applyMasterScheduleAndSend } from "@/lib/actions/publishing";
import { formatDateTime } from "@/lib/format";
import { isoToLondonInput } from "@/lib/datetime";

/**
 * Master post schedule (Duane, 3 Sep 2026), sitting directly under Master
 * media and working the same way: set the date and time once here and every
 * platform version takes it; adjust any platform individually below if it
 * needs its own slot.
 */
export function MasterScheduleField({
  clientId,
  ideaId,
  scheduledAt,
  versionCount,
  awaitingConfirmation,
  handedToAyrshare,
}: {
  clientId: string;
  ideaId: string;
  scheduledAt: string | null;
  /** Unpublished platform versions this would apply to. */
  versionCount: number;
  /** Versions holding a time but not yet on the calendar. */
  awaitingConfirmation: number;
  /** Versions already handed to Ayrshare's scheduler — left alone. */
  handedToAyrshare: number;
}) {
  const [when, setWhen] = useState(isoToLondonInput(scheduledAt));
  const [notice, setNotice] = useState<string | null>(null);
  const [attention, setAttention] = useState<{ label: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * Apply the time, put every version on the calendar, and hand the eligible
   * ones to Ayrshare — one press.
   *
   * Duane: applying the time alone "defeats most of the purpose", because it
   * left five more rounds of Schedule → Send to Ayrshare to do by hand.
   */
  function apply(value: string) {
    setError(null);
    setNotice(null);
    setAttention([]);
    startTransition(async () => {
      // Clearing is only ever the time — nothing to schedule or send.
      if (!value) {
        const cleared = await setMasterSchedule(clientId, ideaId, "");
        if (!cleared.ok) setError(cleared.message);
        else
          setNotice(
            `Master schedule cleared${cleared.data.applied > 0 ? ` — removed from ${cleared.data.applied} version${cleared.data.applied === 1 ? "" : "s"} not yet on the calendar` : ""}.`
          );
        return;
      }

      const result = await applyMasterScheduleAndSend(clientId, ideaId, value);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { scheduled, sent, needsAttention, alreadyWithAyrshare } = result.data;
      const versions = (n: number) => `${n} platform version${n === 1 ? "" : "s"}`;
      setNotice(
        [
          `${versions(scheduled)} scheduled`,
          sent > 0 ? `${sent} handed to Ayrshare to publish automatically` : null,
          alreadyWithAyrshare > 0
            ? `${alreadyWithAyrshare} already with Ayrshare, left alone — reschedule ${alreadyWithAyrshare === 1 ? "it" : "them"} from ${alreadyWithAyrshare === 1 ? "its" : "their"} own row`
            : null,
        ]
          .filter(Boolean)
          .join(" · ") + ". Any platform can still be moved on its own below."
      );
      setAttention(needsAttention);
    });
  }

  function confirmAll() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await scheduleAllOutputs(clientId, ideaId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(`${result.data.scheduled} platform version${result.data.scheduled === 1 ? "" : "s"} now on the calendar.`);
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-accent/30 bg-accent/5 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">Master post schedule</p>
        <p className="mt-0.5 text-xs text-ink-faint">
One press sets the time on every platform version, puts them on the calendar, and hands the connected ones to
          Ayrshare to publish automatically. Each platform stays editable below, so Instagram or TikTok can be moved on
          their own afterwards. Times are UK.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`master-schedule-${ideaId}`}>Publish date &amp; time</Label>
          <Input
            id={`master-schedule-${ideaId}`}
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            disabled={isPending}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => apply(when)} disabled={isPending || !when}>
          {isPending
            ? "Scheduling…"
            : `Schedule ${versionCount === 1 ? "the platform version" : `all ${versionCount} platform versions`} & send`}
        </Button>
        {scheduledAt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWhen("");
              apply("");
            }}
            disabled={isPending}
          >
            Clear
          </Button>
        )}
      </div>
      {scheduledAt && (
        <p className="text-xs text-ink-soft">
          Master schedule: <span className="font-medium text-ink">{formatDateTime(scheduledAt)}</span>
          {handedToAyrshare > 0 && (
            <span className="text-ink-faint">
              {" "}· {handedToAyrshare} version{handedToAyrshare === 1 ? "" : "s"} already with Ayrshare — reschedule those from their own row.
            </span>
          )}
        </p>
      )}
      {awaitingConfirmation > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={confirmAll} disabled={isPending}>
            Put {awaitingConfirmation === 1 ? "the version" : `all ${awaitingConfirmation} versions`} on the calendar
          </Button>
          <span className="text-xs text-ink-faint">
            {awaitingConfirmation === 1 ? "It has" : "They have"} a time but {awaitingConfirmation === 1 ? "isn't" : "aren't"} scheduled yet — or confirm each platform individually below.
          </span>
        </div>
      )}
      {notice && <p className="text-xs text-success">{notice}</p>}
      {attention.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <p className="text-xs font-medium text-ink">
            {attention.length} version{attention.length === 1 ? "" : "s"} need{attention.length === 1 ? "s" : ""} attention — the
            rest went out.
          </p>
          <ul className="mt-1 space-y-0.5">
            {attention.map((item) => (
              <li key={item.label} className="text-xs text-ink-soft">
                <span className="font-medium text-ink">{item.label}</span> — {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

