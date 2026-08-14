import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/audit/intro/page.tsx checks for an in-progress audit to
 * redirect away from. Mirrors the real page's shape — eyebrow, heading,
 * intro paragraph, the honesty callout box, and the five-row scoring guide.
 */
export default function AuditIntroLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />

      <div role="status" aria-label="Loading" className="flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-7 w-2/3" />

        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        <Skeleton className="mt-8 h-24 w-full rounded-lg" />

        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </div>

      <Skeleton className="mt-10 h-11 w-full" />
    </main>
  );
}
