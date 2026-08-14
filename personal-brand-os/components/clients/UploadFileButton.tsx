"use client";

import { useActionState, useEffect, useState } from "react";
import { uploadClientFile } from "@/lib/actions/files";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { FILE_CATEGORIES } from "@/lib/files";

export function UploadFileButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(uploadClientFile, null);

  useEffect(() => {
    if (state?.ok) setIsOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Upload file
      </Button>
      {isOpen && (
        <Modal title="Upload file" onClose={() => setIsOpen(false)}>
          <form
            action={(formData) => {
              formData.set("client_id", clientId);
              formAction(formData);
            }}
            className="space-y-3"
          >
            {state && !state.ok && <Notice kind="danger">{state.message}</Notice>}
            <div>
              <Label htmlFor="upload-file">File</Label>
              <input
                id="upload-file"
                name="file"
                type="file"
                required
                autoFocus
                className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-border"
              />
            </div>
            <div>
              <Label htmlFor="upload-category">Category</Label>
              <Select id="upload-category" name="category" defaultValue="other">
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
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
