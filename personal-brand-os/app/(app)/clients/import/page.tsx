import Link from "next/link";
import { ClientImportForm } from "@/components/import/ClientImportForm";
import { TemplateBox } from "@/components/import/TemplateBox";
import { CLIENT_PROFILE_TEMPLATE } from "@/lib/import/templates";

export const metadata = { title: "Import client profile" };

export default function ClientImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-ink">Import client profile</h1>
        <p className="text-sm text-ink-soft">
          Consultation → AI → structured import → review → client created. Give your AI the template below with the
          transcript or notes; paste its JSON answer here. Nothing is written until you&rsquo;ve reviewed and confirmed, missing
          information stays blank (never guessed), and anything marked &ldquo;needs client confirmation&rdquo; becomes a follow-up
          checklist. Prefer typing it in yourself?{" "}
          <Link href="/clients" className="text-accent underline-offset-2 hover:underline">
            Add a client manually
          </Link>
          .
        </p>
      </div>

      <TemplateBox template={CLIENT_PROFILE_TEMPLATE} label="AI instruction template (client profile)" />
      <ClientImportForm />
    </div>
  );
}
