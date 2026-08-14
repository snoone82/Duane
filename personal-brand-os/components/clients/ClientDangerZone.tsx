"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportClientData, deleteClient } from "@/lib/actions/client-lifecycle";
import { Button } from "@/components/ui/Button";

export function ClientDangerZone({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    startExport(async () => {
      const result = await exportClientData(clientId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const blob = new Blob([result.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clientName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${clientName}" and everything attached to them — vision, positioning, content, consultations, files, all of it? This cannot be undone.`)) return;
    if (!window.confirm("Really sure? Type nothing needed, just confirm again — this is permanent.")) return;
    setError(null);
    startDelete(async () => {
      const result = await deleteClient(clientId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/clients");
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs text-ink-faint">GDPR-related actions — export a full data dump, or permanently delete this client and everything attached to them.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleExport} disabled={isExporting}>
          {isExporting ? "Exporting…" : "Export data"}
        </Button>
        <Button size="sm" variant="danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? "Deleting…" : "Delete client"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
