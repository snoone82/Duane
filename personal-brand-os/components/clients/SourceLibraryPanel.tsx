"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addSourceItem, deleteSourceItem, setSourceItemSensitivity } from "@/lib/actions/source-library";
import { SOURCE_ITEM_KINDS, sourceItemKindMeta } from "@/lib/monthly-plan-format";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/format";
import type { Database } from "@/lib/database.types";

type SourceItem = Database["public"]["Tables"]["client_source_items"]["Row"];

/**
 * Client Source Library (Duane): the consultation is where the person
 * lives. Stories, beliefs, exact phrases, things they reject — each with
 * the client's own wording and the consultation it came from. Generation
 * reads the public items; the AI must cite one (or the profile, or this
 * month's update) for every first-person claim.
 */
export function SourceLibraryPanel({
  clientId,
  items,
  consultations,
  pillars,
}: {
  clientId: string;
  items: SourceItem[];
  consultations: { id: string; meeting_date: string; meeting_type: string | null }[];
  pillars: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const consultationLabel = new Map(consultations.map((c) => [c.id, `${formatDate(c.meeting_date)}${c.meeting_type ? ` · ${c.meeting_type}` : ""}`]));
  const pillarName = new Map(pillars.map((p) => [p.id, p.name]));

  function remove(id: string) {
    if (!window.confirm("Remove this item from the source library?")) return;
    startTransition(async () => {
      const result = await deleteSourceItem(clientId, id);
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  function toggleSensitivity(item: SourceItem) {
    startTransition(async () => {
      const result = await setSourceItemSensitivity(clientId, item.id, item.sensitivity === "sensitive" ? "public" : "sensitive");
      if (!result.ok) setError(result.message);
      else router.refresh();
    });
  }

  const grouped = SOURCE_ITEM_KINDS.map((kind) => ({ kind, items: items.filter((i) => i.kind === kind.value) })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Client Source Library</h2>
          <p className="text-xs text-ink-soft">
            Stories, beliefs and exact phrases from consultations — what the AI is allowed to say in the first person. Sensitive
            items stay here and are never offered to generation.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          + Add item
        </Button>
      </div>
      {error && <Notice kind="danger">{error}</Notice>}
      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-ink-faint">
          No source material extracted yet. Add or import a consultation and PBOS will identify the client&rsquo;s stories,
          beliefs, language, priorities and content opportunities automatically.
        </p>
      ) : (
        grouped.map(({ kind, items: list }) => (
          <div key={kind.value} className="rounded-lg border border-border bg-surface">
            <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
              {kind.plural} <span className="font-normal normal-case tracking-normal">({list.length})</span>
            </p>
            <ul className="divide-y divide-border">
              {list.map((item) => (
                <li key={item.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{item.text}</p>
                      {item.source_quote && <p className="mt-0.5 text-xs italic text-ink-soft">&ldquo;{item.source_quote}&rdquo;</p>}
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {item.source_date ? formatDate(item.source_date) : item.consultation_id ? consultationLabel.get(item.consultation_id) : "No source date"}
                        {item.consultation_id && item.source_date ? ` · ${consultationLabel.get(item.consultation_id)}` : ""}
                        {item.pillar_id && pillarName.get(item.pillar_id) ? ` · ${pillarName.get(item.pillar_id)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <button type="button" onClick={() => toggleSensitivity(item)} disabled={isPending} title="Toggle whether generation may use this">
                        <StatusPill label={item.sensitivity === "sensitive" ? "Sensitive" : "Public"} color={item.sensitivity === "sensitive" ? "red" : "green"} />
                      </button>
                      <Button variant="ghost" size="sm" onClick={() => remove(item.id)} disabled={isPending}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {open && <AddSourceItemModal clientId={clientId} consultations={consultations} pillars={pillars} onClose={() => setOpen(false)} />}
    </section>
  );
}

function AddSourceItemModal({
  clientId,
  consultations,
  pillars,
  onClose,
}: {
  clientId: string;
  consultations: { id: string; meeting_date: string; meeting_type: string | null }[];
  pillars: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(addSourceItem, null);
  const [kind, setKind] = useState(SOURCE_ITEM_KINDS[0]!.value);
  const meta = sourceItemKindMeta(kind);

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);

  return (
    <Modal title="Add to the source library" onClose={onClose}>
      <form
        action={(formData) => {
          formData.set("client_id", clientId);
          formAction(formData);
        }}
        className="space-y-3"
      >
        {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="src-kind">Kind</Label>
            <Select id="src-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {SOURCE_ITEM_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-faint">{meta.hint}</p>
          </div>
          <div>
            <Label htmlFor="src-sens">Sensitivity</Label>
            <Select id="src-sens" name="sensitivity" defaultValue="public">
              <option value="public">Public — generation may use it</option>
              <option value="sensitive">Sensitive — never offered to generation</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="src-text">The item, in plain words</Label>
          <Textarea id="src-text" name="text" rows={2} required autoFocus placeholder={kind === "voice" ? "The phrase itself" : "e.g. A good life is one you don't need to escape from"} />
        </div>
        <div>
          <Label htmlFor="src-quote">The client&rsquo;s own wording (optional, verbatim)</Label>
          <Textarea id="src-quote" name="source_quote" rows={2} placeholder="“When you're aligned, you have a life that you don't need to escape from.”" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="src-cons">From consultation</Label>
            <Select id="src-cons" name="consultation_id" defaultValue="">
              <option value="">Not linked</option>
              {consultations.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatDate(c.meeting_date)}
                  {c.meeting_type ? ` · ${c.meeting_type}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="src-date">Source date</Label>
            <Input id="src-date" name="source_date" type="date" />
          </div>
          <div>
            <Label htmlFor="src-pillar">Pillar / theme</Label>
            <Select id="src-pillar" name="pillar_id" defaultValue="">
              <option value="">None</option>
              {pillars.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
