import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

export function SessionNotice({
  message = "We couldn't find an audit in progress on this device. If you were partway through, reopening this page in the same browser you started in usually brings it right back. Otherwise, let's start fresh — nothing you've already saved is lost.",
}: {
  message?: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center gap-6 px-6 py-16">
      <h1 className="font-heading text-2xl text-ink">Let's get you back in</h1>
      <Notice tone="info">{message}</Notice>
      <Link href="/">
        <Button className="w-full sm:w-auto">Go to the start</Button>
      </Link>
    </main>
  );
}
