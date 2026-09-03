"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { setMasterSchedule, scheduleAllOutputs } from "@/lib/actions/content";
import { formatDateTime } from "@/lib/format";

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
  const [when, setWhen] = useState(toLocalInputValue(scheduledAt));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply(value: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setMasterSchedule(clientId, ideaId, value);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const { applied, skipped } = result.data;
      const versions = (n: number) => `${n} platform version${n === 1 ? "" : "s"}`;
      setNotice(
        value
          ? `Applied to ${versions(applied)}.${skipped > 0 ? ` ${versions(skipped)} already handed to Ayrshare left as ${skipped === 1 ? "it is" : "they are"}.` : ""} Adjust any platform below if it needs a different time.`
          : `Master schedule cleared${applied > 0 ? ` — removed from ${versions(applied)} not yet on the calendar` : ""}.`
      );
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
          Set once here and every platform version takes this date and time. Each platform stays editable below, so
          Instagram or TikTok can be moved on their own afterwards. Changing this re-applies it to every unpublished
          version.
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
          {isPending ? "Applying…" : `Apply to ${versionCount === 1 ? "the platform version" : `all ${versionCount} platform versions`}`}
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
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
