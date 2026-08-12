import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shown while app/audit/complete/page.tsx is looking up the in-progress or
 * completed audit. The score itself is computed client-side after this
 * (CompleteAuditClient shows its own "Working out your score…" text), so
 * this only needs to cover the brief server lookup beforehand.
 */
export default function CompleteLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col items-center justify-center gap-6 px-6 py-16">
      <Logo />
      <div role="status" aria-label="Loading" className="flex flex-col items-center gap-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </main>
  );
}
