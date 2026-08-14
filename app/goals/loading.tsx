import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

export default function GoalsLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <div role="status" aria-label="Loading your goals" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-4 h-40 w-full rounded-lg" />
        <Skeleton className="mt-4 h-24 w-full rounded-lg" />
      </div>
    </main>
  );
}
