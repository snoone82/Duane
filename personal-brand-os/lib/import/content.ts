/** Content Import (Duane batch 3, §2): one master idea + platform versions
 * per entry, validated against the client's approved strategy before
 * anything is created. Parsing only — DB work lives in lib/actions/import.ts. */

import { NEEDS_CONFIRMATION, NOT_APPLICABLE, type ImportIssues } from "@/lib/import/client-profile";

export interface ParsedContentImport extends ImportIssues {
  ideas: {
    title: string;
    pillar: string | null;
    audience: string | null;
    hook: string;
    body: string;
    notes: string;
    priority: "low" | "medium" | "high";
    production_due_date: string | null;
    target_publish_date: string | null;
    outputs: {
      platform: string;
      format: string;
      caption: string;
      cta: string;
      hashtags: string;
      alt_text: string;
      destination_link: string;
      notes: string;
    }[];
  }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(raw: unknown, label: string, issues: ImportIssues): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (typeof raw !== "string") {
    issues.warnings.push(`${label}: expected text — left blank.`);
    return "";
  }
  const value = raw.trim();
  if (value === NEEDS_CONFIRMATION) {
    issues.needsConfirmation.push(label);
    return "";
  }
  if (value === NOT_APPLICABLE) return "";
  return value;
}

function date(raw: unknown, label: string, issues: ImportIssues): string | null {
  const value = text(raw, label, issues);
  if (!value) return null;
  if (!DATE_RE.test(value)) {
    issues.warnings.push(`${label}: "${value}" isn't a YYYY-MM-DD date — left blank.`);
    return null;
  }
  return value;
}

function stripFences(input: string): string {
  return input
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export type ContentParseResult = { ok: true; parsed: ParsedContentImport } | { ok: false; error: string };

export function parseContentImport(input: string): ContentParseResult {
  let root: unknown;
  try {
    root = JSON.parse(stripFences(input));
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste exactly what the AI produced, nothing added around it." };
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { ok: false, error: "The import must be a JSON object." };
  }
  const doc = root as Record<string, unknown>;
  if (doc.pbos_import !== "content") {
    return { ok: false, error: "This isn't a PBOS content import — the pbos_import marker is missing or wrong. Use the content template." };
  }
  if (doc.version !== 1) {
    return { ok: false, error: `Unsupported import version "${String(doc.version)}" — this build understands version 1.` };
  }
  if (!Array.isArray(doc.ideas) || doc.ideas.length === 0) {
    return { ok: false, error: "The import has no ideas — nothing to create." };
  }

  const issues: ImportIssues = { needsConfirmation: [], warnings: [] };

  const ideas = (doc.ideas as unknown[]).flatMap((raw, i) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const title = text(record.title, `Idea ${i + 1} → title`, issues);
    if (!title) {
      issues.warnings.push(`Idea ${i + 1} has no title — skipped.`);
      return [];
    }
    const priorityRaw = text(record.priority, `"${title}" → priority`, issues).toLowerCase();
    const priority: "low" | "medium" | "high" = priorityRaw === "high" || priorityRaw === "low" ? priorityRaw : "medium";

    const outputsRaw = Array.isArray(record.outputs) ? record.outputs : [];
    if (!Array.isArray(record.outputs)) {
      issues.warnings.push(`"${title}": outputs missing — the master idea will be created with no platform versions.`);
    }
    const outputs = outputsRaw.flatMap((o, j) => {
      const out = (typeof o === "object" && o !== null ? o : {}) as Record<string, unknown>;
      const platform = text(out.platform, `"${title}" → output ${j + 1} → platform`, issues);
      if (!platform) {
        issues.warnings.push(`"${title}": output ${j + 1} has no platform — skipped.`);
        return [];
      }
      return [
        {
          platform,
          format: text(out.format, `"${title}" → ${platform} → format`, issues),
          caption: text(out.caption, `"${title}" → ${platform} → caption`, issues),
          cta: text(out.cta, `"${title}" → ${platform} → CTA`, issues),
          hashtags: text(out.hashtags, `"${title}" → ${platform} → hashtags`, issues),
          alt_text: text(out.alt_text, `"${title}" → ${platform} → alt text`, issues),
          destination_link: text(out.destination_link, `"${title}" → ${platform} → destination link`, issues),
          notes: text(out.notes, `"${title}" → ${platform} → notes`, issues),
        },
      ];
    });

    const requirements = text(record.requirements, `"${title}" → requirements`, issues);
    const notes = text(record.notes, `"${title}" → notes`, issues);
    return [
      {
        title,
        pillar: text(record.pillar, `"${title}" → pillar`, issues) || null,
        audience: text(record.audience, `"${title}" → audience`, issues) || null,
        hook: text(record.hook, `"${title}" → hook`, issues),
        body: text(record.brief ?? record.body, `"${title}" → brief`, issues),
        notes: [notes, requirements && `Production requirements: ${requirements}`].filter(Boolean).join("\n\n"),
        priority,
        production_due_date: date(record.production_due_date, `"${title}" → production due`, issues),
        target_publish_date: date(record.target_publish_date, `"${title}" → target publish date`, issues),
        outputs,
      },
    ];
  });

  if (ideas.length === 0) return { ok: false, error: "No usable ideas found — every entry was missing its title." };

  return { ok: true, parsed: { ideas, ...issues } };
}
