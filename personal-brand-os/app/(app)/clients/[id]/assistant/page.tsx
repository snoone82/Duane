import { createClient } from "@/lib/supabase/server";
import { AssistantPanel, type AssistantMessage } from "@/components/clients/AssistantPanel";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Assistant" };

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  // The saved thread — RLS scopes it to this user's own conversation with
  // this client, so switching tabs (or devices) never loses it.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("assistant_messages")
    .select("id,role,content")
    .eq("client_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  const initialMessages: AssistantMessage[] = (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    content: row.content,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-ink-soft">
        Ask questions grounded in everything on file for this client — it only sees what you can see, and your
        conversation is saved here.
      </p>

      {!isConfigured ? (
        <Notice kind="info">
          The assistant isn&rsquo;t switched on yet. Add an <code>ANTHROPIC_API_KEY</code> environment variable in Vercel
          (Settings → Environment Variables) and redeploy — no other setup needed.
        </Notice>
      ) : (
        <AssistantPanel clientId={id} initialMessages={initialMessages} />
      )}
    </div>
  );
}
