import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/dashboard/page.tsx fetches audits, life areas, responses,
 * the latest CLEAR plan, and the active goal + its check-ins. Mirrors the
 * real page's six-piece shape (Score, Chart, Priority Focus, Current Goal,
 * Progress, Next Action) so nothing shifts noticeably once it resolves.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Skeleton className="h-9 w-20" />
      </div>

      <div role="status" aria-label="Loading your dashboard" className="mt-10 flex flex-col items-center gap-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="mt-10">
        <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mt-4 rounded-lg border border-border bg-paper-raised p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </div>
      ))}

      <Skeleton className="mt-10 mb-16 h-24 w-full rounded-lg" />
    </main>
  );
}
