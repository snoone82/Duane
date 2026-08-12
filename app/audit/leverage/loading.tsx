import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/audit/leverage/page.tsx is fetching the ten life areas and
 * the audit's current selection. Mirrors LeverageClient's single-select list.
 */
export default function LeverageLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />

      <div role="status" aria-label="Loading the leverage question" className="flex flex-col gap-3">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />

        <div className="mt-6 flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
