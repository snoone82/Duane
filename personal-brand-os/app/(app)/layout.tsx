import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { TopBar } from "@/components/layout/TopBar";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();

  // Portal clients never see the internal workspace — they get their own
  // read-only surface at /portal (which sends team roles back here).
  if (profile?.role === "client") redirect("/portal");

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-ink">No access</h1>
          <p className="mb-5 text-sm text-ink-soft">
            You&rsquo;re signed in, but there&rsquo;s no profile set up for your account yet. Ask Duane to add
            you in Supabase — Authentication → Users.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="secondary" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <MobileHeader name={profile.full_name || profile.email} role={profile.role} />
      <Sidebar name={profile.full_name || profile.email} role={profile.role} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
