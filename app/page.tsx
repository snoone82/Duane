import { getCurrentUser, getInProgressAudit } from "@/lib/audit-data";
import { StartAuditButton } from "@/components/landing/StartAuditButton";
import { Logo } from "@/components/ui/Logo";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const inProgress = user ? await getInProgressAudit(user.id) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col justify-center px-6 py-16">
      <Logo />

      <h1 className="mt-8 font-heading text-3xl leading-tight text-ink">
        The Audit
      </h1>

      <p className="mt-6 text-lg leading-snug text-ink-soft">
        Ten honest questions about where your life actually stands right now.
        It takes about twenty minutes. At the end you get your Alignment
        Score, and a human coach — not an algorithm — reads every single
        response.
      </p>

      <p className="mt-4 text-base text-ink-soft">
        No account needed to start. We'll ask you to save your results once
        you've finished.
      </p>

      <div className="mt-10">
        <StartAuditButton hasInProgress={Boolean(inProgress)} />
      </div>
    </main>
  );
}
