import Link from "next/link";
import { getCurrentUser, getProfile } from "@/lib/audit-data";
import { SessionNotice } from "@/components/audit/SessionNotice";
import { Logo } from "@/components/ui/Logo";
import { RequestDeletionClient } from "@/components/account/RequestDeletionClient";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return <SessionNotice />;

  const profile = await getProfile(user.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--content-max-width)] flex-col px-6 py-10">
      <Logo className="mb-8" />
      <Link href="/dashboard" className="inline-flex min-h-[var(--tap-target-min)] w-fit items-center text-sm text-ink-soft">
        ← Dashboard
      </Link>

      <h1 className="mt-4 font-heading text-2xl text-ink">Account</h1>

      {profile?.email && (
        <p className="mt-2 text-sm text-ink-soft">
          Signed in as <span className="text-ink">{profile.email}</span>.{" "}
          <Link href="/reset-password" className="font-medium text-gold-strong underline">
            Change password
          </Link>
        </p>
      )}

      <section className="mt-10 border-t border-border pt-8">
        <h2 className="font-heading text-lg text-ink">Delete my account</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Permanently removes your account and everything you&apos;ve shared with Aligned.
        </p>
        <div className="mt-4">
          <RequestDeletionClient alreadyRequested={Boolean(profile?.deletion_requested_at)} />
        </div>
      </section>
    </main>
  );
}
