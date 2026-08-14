import type { TagColor } from "@/lib/status";

const colorClass: Record<TagColor, string> = {
  slate: "bg-[--tag-slate-bg] text-[--tag-slate-text]",
  blue: "bg-[--tag-blue-bg] text-[--tag-blue-text]",
  cyan: "bg-[--tag-cyan-bg] text-[--tag-cyan-text]",
  teal: "bg-[--tag-teal-bg] text-[--tag-teal-text]",
  green: "bg-[--tag-green-bg] text-[--tag-green-text]",
  amber: "bg-[--tag-amber-bg] text-[--tag-amber-text]",
  orange: "bg-[--tag-orange-bg] text-[--tag-orange-text]",
  purple: "bg-[--tag-purple-bg] text-[--tag-purple-text]",
  pink: "bg-[--tag-pink-bg] text-[--tag-pink-text]",
  red: "bg-[--tag-red-bg] text-[--tag-red-text]",
};

export function StatusPill({ label, color }: { label: string; color: TagColor }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium leading-5 ${colorClass[color]}`}
    >
      {label}
    </span>
  );
}
