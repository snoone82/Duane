import { PdfBuilder } from "@/lib/pdf/builder";
import type { PerformanceData } from "@/lib/data/performance";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { contentStatusMeta, authorityStatusMeta } from "@/lib/status";
import type { ContentStatus, AuthorityStatus } from "@/lib/enums";

/** The Performance / Progress Report — "what we've done, what happened,
 * what happens next." */
export async function buildPerformanceReportPdf(
  data: PerformanceData,
  photo?: { bytes: Uint8Array; kind: "png" | "jpg" } | null
): Promise<Uint8Array> {
  const pdf = await PdfBuilder.create();

  await pdf.header(
    "Personal Brand Performance Report",
    data.clientName,
    `${data.periodLabel} · ${formatDate(data.from)} – ${formatDate(data.to)}`,
    photo
  );

  if (data.platforms.length > 0) {
    pdf.heading("Headline Audience Metrics");
  pdf.divider();
    pdf.stats(
      data.platforms.map((p) => ({
        value: `${p.change >= 0 ? "+" : ""}${formatNumber(p.change)}`,
        caption: `${p.platform} · ${formatNumber(p.startFollowers)} to ${formatNumber(p.endFollowers)} followers`,
      }))
    );
  }

  pdf.heading("Content Performance");
  pdf.divider();
  if (data.content.length === 0) {
    pdf.para("No content reached Published in this period.");
  } else {
    pdf.stats(
      [
        { value: String(data.contentPublished), caption: "pieces published" },
        ...(data.avgReach !== null ? [{ value: formatNumber(data.avgReach), caption: "average reach" }] : []),
        ...(data.avgEngagement !== null
          ? [{ value: formatNumber(data.avgEngagement), caption: "average engagement" }]
          : []),
      ]
    );
    for (const item of data.content.slice(0, 12)) {
      pdf.bullet(
        [
          item.title,
          item.platform && `(${item.platform})`,
          item.reach !== null && `reach ${formatNumber(item.reach)}`,
          item.engagement !== null && `engagement ${formatNumber(item.engagement)}`,
          `— ${contentStatusMeta(item.status as ContentStatus).label}`,
        ]
          .filter(Boolean)
          .join(" ")
      );
    }
    if (data.content.length > 12) pdf.note(`…and ${data.content.length - 12} more.`);
  }

  if (data.authority.length > 0) {
    pdf.heading("Authority Wins");
  pdf.divider();
    for (const item of data.authority) {
      pdf.bullet(
        [item.type, item.host && `with ${item.host}`, `— ${authorityStatusMeta(item.status as AuthorityStatus).label}`]
          .filter(Boolean)
          .join(" ")
      );
    }
  }

  if (data.commercial.length > 0 || data.funnel.length > 0) {
    pdf.heading("Commercial Outcomes");
  pdf.divider();
    if (data.funnel.length > 0) {
      pdf.stats(data.funnel.map((f) => ({ value: formatNumber(f.value), caption: f.label.toLowerCase() })));
    }
    for (const item of data.commercial) {
      pdf.bullet(
        [item.description, item.value !== null && `— ${formatCurrency(item.value)}`, `(${formatDate(item.date)})`]
          .filter(Boolean)
          .join(" ")
      );
    }
    if (data.commercialTotal > 0) {
      pdf.spacer(2);
      pdf.field("Attributed revenue this period", formatCurrency(data.commercialTotal));
    }
  }

  if (data.milestones.length > 0) {
    pdf.heading("Milestones");
  pdf.divider();
    for (const milestone of data.milestones) {
      pdf.subitem(`${milestone.title} — ${formatDate(milestone.date)}`, milestone.description);
    }
  }

  if (data.nextActions.length > 0) {
    pdf.heading("What Happens Next");
  pdf.divider();
    for (const action of data.nextActions) {
      pdf.bullet(action.dueDate ? `${action.title} — by ${formatDate(action.dueDate)}` : action.title);
    }
  }

  return pdf.finish(`Aligned Media · Performance Report · ${data.clientName} · ${data.periodLabel}`);
}
