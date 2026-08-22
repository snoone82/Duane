/** Small, boring formatting helpers used across every tab. */

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatRelativeToToday(value: string | null | undefined): string {
  if (!value) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`;
  return formatDate(value);
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${dueDate}T00:00:00`).getTime() < today.getTime();
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** e.g. "Positioning" -> "positioning" for the URL-addressable tab slug. */
export function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** audit_log's action values → past-tense verbs for activity feeds
 * ("insert" + "d" made "insertd" — caught live). */
/** "LinkedIn — Daniel Andrews" when an account name is set, else "LinkedIn".
 * The one label format for publishing accounts across content, calendar,
 * portal and PDFs. */
export function socialAccountLabel(platform: string, accountName?: string | null): string {
  return accountName?.trim() ? `${platform} — ${accountName.trim()}` : platform;
}

export function auditVerb(action: string): string {
  switch (action) {
    case "insert":
      return "created";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
    default:
      return action;
  }
}
