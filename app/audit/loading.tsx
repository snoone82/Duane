import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/audit/page.tsx is fetching the current audit, life areas
 * and existing responses. Mirrors AuditAreaClient's layout at a glance —
 * progress bar, heading, the two visibly-different rating shapes (10-grid
 * vs. 5-pill row) — so nothing shifts noticeably once the real content
 * arrives.
 */
export default function AuditLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />

      <div role="status" aria-label="Loading your audit" className="flex flex-1 flex-col gap-8">
        <Skeleton className="h-2 w-full rounded-full" />

        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-8">
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 flex-1" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-11 w-28" />
      </div>
    </main>
  );
}
