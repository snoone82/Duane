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

  return (
    <div className="-mx-6 -my-6">
      <div className="border-b border-border bg-surface">
        <ClientHeader client={client} />
        <ClientTabs clientId={id} />
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
