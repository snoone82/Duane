/** A small square media preview used on content cards and calendar entries.
 * Plain <img> — these are signed storage URLs next/image can't optimise. */
export function MediaThumb({ url, size = "md" }: { url: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-7 w-7" : "h-14 w-14";
  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, next/image can't optimise it
  return <img src={url} alt="" className={`${cls} flex-shrink-0 rounded-md border border-border object-cover`} />;
}
