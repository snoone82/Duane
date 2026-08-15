"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createSignoffPack } from "@/lib/actions/signoff";

export function CreateSignoffButton({ clientId, nextVersion }: { clientId: string; nextVersion: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createSignoffPack(clientId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="text-right">
      <Button variant="primary" onClick={handleCreate} disabled={isPending}>
        {isPending ? "Capturing…" : `+ Create pack (v${nextVersion})`}
      </Button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
