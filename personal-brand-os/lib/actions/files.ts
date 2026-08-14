"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runAction, type ActionResult } from "@/lib/action-result";
import type { FileCategory } from "@/lib/enums";

const BUCKET = "client-files";

export async function uploadClientFile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const clientId = String(formData.get("client_id") ?? "");
  const category = String(formData.get("category") ?? "other") as FileCategory;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file first." };
  }

  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // The path convention (clients/{client_id}/...) is what the storage RLS
    // policies in the migration check against — see client_files_storage_*.
    const storagePath = `clients/${clientId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || undefined,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await supabase.from("client_files").insert({
      client_id: clientId,
      file_name: file.name,
      storage_path: storagePath,
      category,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
    });
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    revalidatePath(`/clients/${clientId}/files`);
    return undefined;
  });
}

export async function deleteClientFile(clientId: string, fileId: string, storagePath: string): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([storagePath]);
    const { error } = await supabase.from("client_files").delete().eq("id", fileId);
    if (error) throw new Error(error.message);
    revalidatePath(`/clients/${clientId}/files`);
    return undefined;
  });
}

export async function getFileDownloadUrl(storagePath: string): Promise<ActionResult<string>> {
  return runAction(async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
    if (error || !data) throw new Error(error?.message ?? "Couldn't create a download link.");
    return data.signedUrl;
  });
}
