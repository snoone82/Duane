import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getPortalContext } from "@/lib/data/portal";
import { PortalSidebar, PortalMobileHeader, type PortalNavItem } from "@/components/portal/PortalSidebar";
import { PreviewBanner } from "@/components/portal/PreviewBanner";
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
  const context = await getPortalContext();

  // Team roles have the full workspace — the portal is only for client
  // accounts, with one exception: an admin running a read-only View as User
  // preview. getPortalContext() only returns a preview for an admin whose
  // cookie names a real portal user, so this can't widen access on its own.
  if (profile && profile.role !== "client" && !context?.preview) redirect("/");

  if (!profile || !context) {
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

  // Same navigation shell as the admin workspace — sidebar on desktop,
  // hamburger drawer on phones — with the client's own sections.
  const navItems: PortalNavItem[] = [
    { href: "/portal", label: "Dashboard" },
    ...(context.can("view_strategy") ? [{ href: "/portal/strategy", label: "Strategy" }] : []),
    ...(context.can("view_strategy") ? [{ href: "/portal/signoff", label: "Sign-off" }] : []),
    { href: "/portal/priorities", label: "Actions" },
    ...(context.can("view_content") ? [{ href: "/portal/content", label: "Content" }] : []),
    { href: "/portal/calendar", label: "Calendar" },
    ...(context.can("view_progress") ? [{ href: "/portal/progress", label: "Progress" }] : []),
    ...(context.can("view_meetings") ? [{ href: "/portal/meetings", label: "Meetings" }] : []),
    ...(context.can("connect_social") ? [{ href: "/portal/accounts", label: "Social accounts" }] : []),
  ];
  const personName = context.member?.name ?? context.client.name;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {context.preview && <PreviewBanner name={context.preview.name} />}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <PortalMobileHeader items={navItems} clientName={context.client.name} personName={personName} previewing={Boolean(context.preview)} />
      <PortalSidebar items={navItems} clientName={context.client.name} personName={personName} previewing={Boolean(context.preview)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Same metrics as the admin workspace: identical padding, and no
            layout-level width cap - each page sets its own, exactly as the
            admin pages do. The portal felt cramped because the content was
            pinned to max-w-4xl and centred while the sidebar stayed the same
            width, which read as an oversized sidebar. */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
      </div>
    </div>
  );
}
