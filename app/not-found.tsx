import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Logo } from "@/components/ui/Logo";

/**
 * Root-level 404. Next.js renders this for any unmatched route, and also
 * whenever code calls next/navigation's notFound().
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center gap-6 px-6 py-16">
      <Logo />
      <h1 className="font-heading text-2xl text-ink">We couldn&rsquo;t find that page</h1>
      <Notice tone="info">
        The page you&rsquo;re looking for doesn&rsquo;t exist, or the link&rsquo;s gone stale.
        Nothing you&rsquo;ve already saved is affected.
      </Notice>
      <Link href="/" className="w-full sm:w-auto">
        <Button className="w-full sm:w-auto">Go to the start</Button>
      </Link>
    </main>
  );
}
