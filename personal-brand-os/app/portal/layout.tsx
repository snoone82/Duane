import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getPortalClient } from "@/lib/data/portal";
import { PortalNav } from "@/components/portal/PortalNav";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";

export const metadata = { title: { template: "%s · Client portal", default: "Client portal" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  // Team roles have the full workspace — the portal is only for client accounts.
  if (profile && profile.role !== "client") redirect("/");

  const client = await getPortalClient();

  if (!profile || !client) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-ink">Portal not set up yet</h1>
          <p className="mb-5 text-sm text-ink-soft">
            You&rsquo;re signed in, but this account isn&rsquo;t linked to a client profile yet. Ask the
            Aligned Media team to connect your login to your brand.
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
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-6 pb-3 pt-5">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
          <img src="/brand/logo-lockup.png" alt="Aligned Media" className="h-8 w-auto" />
          <div>
            <p className="text-sm font-semibold text-ink">{client.name}</p>
            <p className="text-xs text-ink-faint">Your personal brand, at a glance</p>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <PortalNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
