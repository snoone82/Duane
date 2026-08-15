import { AssistantPanel } from "@/components/clients/AssistantPanel";
import { Notice } from "@/components/ui/Notice";

export const metadata = { title: "Assistant" };

export default async function AssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-ink-soft">
        Ask questions grounded in everything on file for this client — it only sees what you can see.
      </p>

      {!isConfigured ? (
        <Notice kind="info">
          The assistant isn&rsquo;t switched on yet. Add an <code>ANTHROPIC_API_KEY</code> environment variable in Vercel
          (Settings → Environment Variables) and redeploy — no other setup needed.
        </Notice>
      ) : (
        <AssistantPanel clientId={id} />
      )}
    </div>
  );
}
