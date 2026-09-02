import { getPortalContext } from "@/lib/data/portal";
import { ConnectAccounts } from "@/components/portal/ConnectAccounts";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAyrshareConfigured } from "@/lib/ayrshare";

export const metadata = { title: "Social accounts" };

export default async function PortalAccountsPage() {
  const context = await getPortalContext();
  if (!context) return null;

  if (!context.can("connect_social")) {
    return (
      <EmptyState
        title="Not enabled for your account"
        description="Connecting social accounts isn't switched on for you. Your Aligned Media contact can enable it."
      />
    );
  }

  if (!isAyrshareConfigured()) {
    return (
      <EmptyState
        title="Not available yet"
        description="Publishing connections aren't set up on this workspace yet. Your Aligned Media contact will let you know when they are."
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">
        Connect the accounts you&rsquo;d like us to publish to on your behalf. You stay in control — access is granted by you,
        directly with each platform, and can be withdrawn whenever you choose.
      </p>
      <ConnectAccounts />
    </div>
  );
}
