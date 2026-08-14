import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/** Shown while app/clear/page.tsx resolves the audit, focus area, and CLEAR plan state. */
export default function ClearLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />

      <div role="status" aria-label="Loading" className="flex flex-1 flex-col gap-8">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-2/3" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </main>
  );
}
