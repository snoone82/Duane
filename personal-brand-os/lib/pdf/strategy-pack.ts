import { PdfBuilder } from "@/lib/pdf/builder";
import type { StrategySnapshot } from "@/lib/signoff-snapshot";
import { formatDate } from "@/lib/format";

export interface StrategyPackMeta {
  version: number;
  status: string;
  approvedByName: string;
  approvedAt: string | null;
  clientComments: string;
  createdAt: string;
}

/** The Strategy Sign-off Pack — "what we've agreed and where we're going." */
export async function buildStrategyPackPdf(snapshot: StrategySnapshot, meta: StrategyPackMeta): Promise<Uint8Array> {
  const pdf = await PdfBuilder.create();

  const statusLine =
    meta.status === "approved"
      ? `Approved by ${meta.approvedByName || "the client"} on ${formatDate(meta.approvedAt?.slice(0, 10))}`
      : meta.status === "changes_requested"
        ? "Changes requested — awaiting revision"
        : meta.status === "sent"
          ? "Awaiting client approval"
          : "Draft — not yet shared";

  pdf.header(
    "Personal Brand Strategy",
    snapshot.clientName,
    `Version ${meta.version} · Prepared ${formatDate(meta.createdAt.slice(0, 10))} · ${statusLine}`
  );

  if (snapshot.northStar) {
    pdf.heading("North Star");
    pdf.para(snapshot.northStar);
  }

  if (snapshot.vision.length > 0) {
    pdf.heading("Vision");
    for (const field of snapshot.vision) pdf.field(field.label, field.value);
  }

  if (snapshot.positioning.length > 0) {
    pdf.heading("Positioning");
    for (const field of snapshot.positioning) pdf.field(field.label, field.value);
  }

  if (snapshot.authorityPosition) {
    pdf.heading("Authority Position");
    pdf.para(snapshot.authorityPosition);
  }

  if (snapshot.audiences.length > 0) {
    pdf.heading("Audiences");
    for (const audience of snapshot.audiences) pdf.subitem(audience.name, audience.description);
  }

  if (snapshot.pillars.length > 0) {
    pdf.heading("Content Pillars");
    for (const pillar of snapshot.pillars) {
      pdf.subitem(pillar.name, pillar.description);
      if (pillar.keyMessages) pdf.field("Key messages", pillar.keyMessages);
    }
  }

  if (snapshot.coreMessages) {
    pdf.heading("Core Messages");
    pdf.para(snapshot.coreMessages);
  }

  if (snapshot.commercialObjectives.length > 0) {
    pdf.heading("Commercial Objectives");
    for (const field of snapshot.commercialObjectives) pdf.field(field.label, field.value);
  }

  if (snapshot.platforms.length > 0) {
    pdf.heading("Platforms & Direction");
    for (const platform of snapshot.platforms) {
      pdf.subitem(
        platform.platform,
        [platform.objective, platform.postingFrequency && `Cadence: ${platform.postingFrequency}`]
          .filter(Boolean)
          .join(" ")
      );
    }
  }

  if (snapshot.priorities.length > 0) {
    pdf.heading("Initial Priorities");
    for (const priority of snapshot.priorities) {
      pdf.bullet(priority.dueDate ? `${priority.title} — by ${formatDate(priority.dueDate)}` : priority.title);
    }
  }

  if (meta.clientComments.trim()) {
    pdf.heading("Client Comments");
    pdf.para(meta.clientComments);
  }

  pdf.spacer(10);
  pdf.note(
    meta.status === "approved"
      ? "This approved version is the agreed baseline for the personal brand strategy."
      : "Once approved, this version becomes the agreed baseline for the personal brand strategy."
  );

  return pdf.finish(`Aligned Media · Personal Brand Strategy · ${snapshot.clientName} · v${meta.version}`);
}
