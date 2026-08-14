import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="text-center">
        <h1 className="mb-2 text-lg font-semibold text-ink">Page not found</h1>
        <p className="mb-5 text-sm text-ink-soft">That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
        <Link href="/">
          <Button variant="primary">Back to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
