/**
 * One upload ceiling for the whole app.
 *
 * Supabase enforces a project-wide upload cap (500 MB since the move to the
 * Pro plan on 1 Sep 2026 — raised in both places it is set: the project's
 * global storage limit and the client-files bucket's own limit);
 * anything larger is rejected by storage itself with a raw "max file size
 * exceeded" error the person can do nothing with. So the app checks first
 * and says something useful, and this constant is the single place to raise
 * the number if the Supabase plan's cap ever goes up.
 */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Null when the file is fine; otherwise the message to show. */
export function checkUploadSize(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `That file is ${formatBytes(file.size)} — uploads are capped at 500 MB. For anything larger, use the Media URL field: host the file somewhere it can be reached directly and paste the link, and publishing sends that file rather than an upload.`;
}
