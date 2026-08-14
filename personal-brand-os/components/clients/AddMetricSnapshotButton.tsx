"use client";

import { useActionState, useEffect, useState } from "react";
import { addMetricSnapshot } from "@/lib/actions/metrics";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { PLATFORM_SUGGESTIONS } from "@/lib/metrics";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Brief §15 Social Metrics, minus `followers` (required, shown separately).
const OPTIONAL_METRICS: { name: string; label: string }[] = [
  { name: "follower_growth", label: "Follower growth" },
  { name: "impressions", label: "Impressions" },
  { name: "reach", label: "Reach" },
  { name: "engagement", label: "Engagement" },
  { name: "profile_visits", label: "Profile visits" },
  { name: "video_views", label: "Video views" },
  { name: "comments", label: "Comments" },
  { name: "shares", label: "Shares" },
  { name: "saves", label: "Saves" },
];

export function AddMetricSnapshotButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addMetricSnapshot, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button size="sm" onClick={() => setIsOpen(true)}>
        + Add snapshot
      </Button>
      {isOpen && (
        <Modal title="Add metric snapshot" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="snap-platform">Platform</Label>
              <Input id="snap-platform" name="platform" list="platform-suggestions" required autoFocus autoComplete="off" />
              <datalist id="platform-suggestions">
                {PLATFORM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="snap-date">Date</Label>
                <Input id="snap-date" name="snapshot_date" type="date" defaultValue={today()} required />
              </div>
              <div>
                <Label htmlFor="snap-followers">Followers</Label>
                <Input id="snap-followers" name="followers" type="number" step="any" required />
              </div>
            </div>
            <p className="text-xs text-ink-faint">Everything below is optional — fill in whatever you have for this platform today.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {OPTIONAL_METRICS.map((metric) => (
                <div key={metric.name}>
                  <Label htmlFor={`snap-${metric.name}`}>{metric.label}</Label>
                  <Input id={`snap-${metric.name}`} name={metric.name} type="number" step="any" />
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-faint">A second snapshot on the same day for this platform updates it, rather than duplicating.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving…" : "Save snapshot"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
