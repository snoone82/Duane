/** A small square media preview used on content cards and calendar entries.
 * Plain <img>/<video> — these are signed storage URLs next/image can't
 * optimise. A video shows its first frame (the #t fragment nudges browsers
 * that otherwise leave the element blank until play), with a play badge so
 * a client can tell a clip from a still at a glance. */
export function MediaThumb({ url, kind = "image", size = "md" }: { url: string; kind?: "image" | "video"; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-7 w-7" : "h-14 w-14";
  if (kind === "video") {
    return (
      <span className={`relative ${cls} flex-shrink-0 overflow-hidden rounded-md border border-border bg-black/40`}>
        <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center text-white drop-shadow ${size === "sm" ? "text-[9px]" : "text-sm"}`}
        >
          ▶
        </span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, next/image can't optimise it
  return <img src={url} alt="" className={`${cls} flex-shrink-0 rounded-md border border-border object-cover`} />;
}
