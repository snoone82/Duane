"use client";

import { useState, useTransition } from "react";
import { getFileDownloadUrl, deleteClientFile } from "@/lib/actions/files";
import { Td, Tr } from "@/components/ui/Table";
import { formatBytes, formatDate } from "@/lib/format";
import { fileCategoryLabel } from "@/lib/files";
import type { Database } from "@/lib/database.types";

type ClientFile = Database["public"]["Tables"]["client_files"]["Row"];

export function FileRow({ clientId, file }: { clientId: string; file: ClientFile }) {
  const [isDownloading, startDownload] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDownload() {
    setError(null);
    startDownload(async () => {
      const result = await getFileDownloadUrl(file.storage_path);
      if (result.ok) {
        window.location.href = result.data;
      } else {
        setError(result.message);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${file.file_name}"? This can't be undone.`)) return;
    startDelete(async () => {
      const result = await deleteClientFile(clientId, file.id, file.storage_path);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <Tr>
      <Td className="font-medium text-ink">
        <button type="button" onClick={handleDownload} disabled={isDownloading} className="text-left hover:underline">
          {file.file_name}
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </Td>
      <Td className="text-ink-soft">{fileCategoryLabel(file.category)}</Td>
      <Td className="text-ink-soft">{formatBytes(file.size_bytes)}</Td>
      <Td className="text-ink-faint">{formatDate(file.created_at.slice(0, 10))}</Td>
      <Td>
        <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-xs text-ink-faint hover:text-danger">
          {isDeleting ? "…" : "Delete"}
        </button>
      </Td>
    </Tr>
  );
}
