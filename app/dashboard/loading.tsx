import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/dashboard/page.tsx fetches the completed audit, life
 * areas and responses. Mirrors the four fixed sections of the real page:
 * score, radar chart, area breakdown list, "what happens next".
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <Logo />
        <Skeleton className="h-9 w-20" />
      </div>

      <div role="status" aria-label="Loading your results" className="mt-10 flex flex-col items-center gap-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-32 w-32 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>

      <div className="mt-10">
        <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-lg" />
      </div>

      <section className="mt-10">
        <Skeleton className="h-6 w-32" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </section>

      <div className="mt-10 mb-16">
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </main>
  );
}
