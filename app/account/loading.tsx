import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Skeleton";

export default function AccountLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <div role="status" aria-label="Loading your account" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-6 h-20 w-full rounded-md" />
      </div>
    </main>
  );
}
