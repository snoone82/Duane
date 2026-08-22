import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientById } from "@/lib/data/client";
import { ClientHeader } from "@/components/clients/ClientHeader";
import { ClientTabs } from "@/components/clients/ClientTabs";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const client = await getClientById(supabase, id);

  if (!client) notFound();

  // Header strip: primary social accounts (Social tab is the single source
  // of truth for social URLs) + website. "LinkedIn | Instagram | Website".
  const { data: primaries } = await supabase
    .from("social_strategies")
    .select("platform,account_name,url")
    .eq("client_id", id)
    .eq("is_primary", true)
    .neq("url", "")
    .order("sort_order");
  const headerLinks = [
    ...(primaries ?? []).map((account) => ({
      label: account.account_name ? `${account.platform} — ${account.account_name}` : account.platform,
      url: account.url,
    })),
    ...(client.website_url ? [{ label: "Website", url: client.website_url }] : []),
  ];

  return (
    <div className="-mx-6 -my-6">
      <div className="border-b border-border bg-surface">
        <ClientHeader client={client} links={headerLinks} />
        <ClientTabs clientId={id} />
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
