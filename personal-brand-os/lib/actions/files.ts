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

/** Duane feedback batch 1: client profile photo upload. Stored in the same
 * private bucket under the client's path (so the existing storage RLS
 * applies), referenced from clients.photo_url via a long-lived signed URL —
 * an internal tool doesn't need a public bucket for this. */
export async function uploadClientPhoto(clientId: string, formData: FormData): Promise<ActionResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image first." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "That file isn't an image." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "Keep the photo under 5 MB." };

  return runAction(async () => {
    const supabase = await createClient();
    const storagePath = `clients/${clientId}/avatar/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || undefined,
    });
    if (uploadError) throw new Error(uploadError.message);

    // Ten years — effectively permanent for an internal tool; re-uploading
    // simply points photo_url at a new file.
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);
    if (signError || !signed) throw new Error(signError?.message ?? "Couldn't create the image link.");

    const { error: updateError } = await supabase
      .from("clients")
      .update({ photo_url: signed.signedUrl })
      .eq("id", clientId);
    if (updateError) throw new Error(updateError.message);

    revalidatePath(`/clients/${clientId}`, "layout");
    revalidatePath("/clients");
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
