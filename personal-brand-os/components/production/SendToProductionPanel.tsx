"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Input, Label, Select } from "@/components/ui/Input";
import { addContentToProduction } from "@/lib/actions/production";

export interface ProducibleIdea {
  id: string;
  title: string;
  /** How many platform versions it has — what the assets will serve. */
  outputCount: number;
}

/**
 * Select several approved Master Ideas and send them to a production day in
 * one action (Duane).
 *
 * The old path was: open each idea, approve it, fill in owner/date/accounts,
 * repeat, then go to Production, create the day, attach, open each one, add
 * an asset, fill another form. Ten ideas meant well over thirty steps. This
 * is two: tick them, pick or name the day.
 *
 * Assets are proposed from each idea's existing platform versions — PBOS
 * already knows what a Reel and a video need, so it stops asking.
 */
export function SendToProductionPanel({
  clientId,
  ideas,
  days,
}: {
  clientId: string;
  ideas: ProducibleIdea[];
  days: { id: string; title: string; productionDate: string }[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"existing" | "new">(days.length > 0 ? "existing" : "new");
  const [jobId, setJobId] = useState(days[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (ideas.length === 0) return null;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function send() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await addContentToProduction(
        clientId,
        [...picked],
        mode === "existing" ? { jobId } : { title, productionDate: date, startTime, location, ownerName }
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDone(
        `${result.data.attached} piece${result.data.attached === 1 ? "" : "s"} added` +
          (result.data.assetsCreated > 0
            ? ` — ${result.data.assetsCreated} asset${result.data.assetsCreated === 1 ? "" : "s"} created from their platform versions.`
            : ".")
      );
      setPicked(new Set());
      router.refresh();
      router.push(`/clients/${clientId}/production/${result.data.jobId}`);
    });
  }

  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer list-none px-4 py-3">
        <span className="text-sm font-semibold text-ink">Send content to production</span>
        <span className="ml-2 text-xs text-ink-soft">
          {ideas.length} piece{ideas.length === 1 ? "" : "s"} approved and not yet on a production day
        </span>
      </summary>

      <div className="space-y-3 border-t border-border p-4">
        {error && <Notice kind="danger">{error}</Notice>}
        {done && <Notice kind="success">{done}</Notice>}

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                <input type="checkbox" className="mt-0.5" checked={picked.has(idea.id)} onChange={() => toggle(idea.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{idea.title}</span>
                  <span className="block text-xs text-ink-faint">
                    {idea.outputCount} platform version{idea.outputCount === 1 ? "" : "s"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setPicked(new Set(ideas.map((i) => i.id)))}
            className="text-xs text-accent underline-offset-2 hover:underline"
          >
            Select all
          </button>
          {picked.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())} className="text-xs text-ink-faint underline-offset-2 hover:underline">
              Clear
            </button>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-4">
            {days.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
                An existing day
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
              A new production day
            </label>
          </div>

          {mode === "existing" ? (
            <div>
              <Label htmlFor="stp_job">Production day</Label>
              <Select id="stp_job" value={jobId} onChange={(event) => setJobId(event.target.value)}>
                {days.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.title} — {day.productionDate}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="stp_title">What is the day?</Label>
                <Input
                  id="stp_title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Jonny Gallanders — September production day"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="stp_date">Date</Label>
                  <Input id="stp_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="stp_time">Start time</Label>
                  <Input id="stp_time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="stp_location">Location</Label>
                  <Input id="stp_location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Studio" />
                </div>
                <div>
                  <Label htmlFor="stp_owner">Owner for the day</Label>
                  <Input
                    id="stp_owner"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Everything made that day inherits this"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="primary" onClick={send} disabled={isPending || picked.size === 0}>
            {isPending ? "Adding…" : `Add ${picked.size || ""} to production`.replace("  ", " ")}
          </Button>
        </div>
      </div>
    </details>
  );
}
