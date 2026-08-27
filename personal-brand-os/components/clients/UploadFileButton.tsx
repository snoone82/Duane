"use client";

import { useRef, useState, useTransition } from "react";
import { registerClientFile } from "@/lib/actions/files";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { FILE_CATEGORIES } from "@/lib/files";
import { checkUploadSize } from "@/lib/uploads";
import type { FileCategory } from "@/lib/enums";

export function UploadFileButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    const category = (categoryRef.current?.value ?? "other") as FileCategory;
    if (!file || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    const sizeError = checkUploadSize(file);
    if (sizeError) {
      setError(sizeError);
      return;
    }
    setError(null);
    startTransition(async () => {
      // Straight from the browser to storage — the old server-action path
      // silently failed for anything over ~1 MB.
      const supabase = createClient();
      const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
      const storagePath = `clients/${clientId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("client-files")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const result = await registerClientFile(clientId, storagePath, file.name, category, file.size);
      if (!result.ok) {
        await supabase.storage.from("client-files").remove([storagePath]);
        setError(result.message);
        return;
      }
      setIsOpen(false);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Upload file
      </Button>
      {isOpen && (
        <Modal title="Upload file" onClose={() => setIsOpen(false)}>
          <div className="space-y-3">
            {error && <Notice kind="danger">{error}</Notice>}
            <div>
              <Label htmlFor="upload-file">File</Label>
              <input
                id="upload-file"
                ref={fileRef}
                type="file"
                required
                autoFocus
                className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-border"
              />
            </div>
            <div>
              <Label htmlFor="upload-category">Category</Label>
              <Select id="upload-category" ref={categoryRef} defaultValue="other">
                {FILE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleUpload} disabled={isPending}>
                {isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
