import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
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

  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
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
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar name={profile.full_name || profile.email} role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
