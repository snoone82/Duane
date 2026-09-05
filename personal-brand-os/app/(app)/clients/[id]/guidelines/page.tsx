import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContentGuidelinesForm } from "@/components/clients/ContentGuidelinesForm";

export const metadata = { title: "Content Guidelines" };

export default async function ContentGuidelinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: guidelines } = await supabase.from("content_guidelines").select("*").eq("client_id", id).maybeSingle();
  if (!guidelines) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-ink-soft">
        The permanent tone, language and CTA direction every Monthly Plan inherits from — set once here, editable per month from the
        plan itself without ever being reconstructed from scratch. Saves as you go.
      </p>
      <ContentGuidelinesForm clientId={id} guidelines={guidelines} />
    </div>
  );
}
