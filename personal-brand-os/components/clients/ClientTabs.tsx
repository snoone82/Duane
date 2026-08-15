"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "vision", label: "Vision" },
  { slug: "positioning", label: "Positioning" },
  { slug: "audiences", label: "Audiences" },
  { slug: "social", label: "Social" },
  { slug: "content", label: "Content" },
  { slug: "sales", label: "Sales" },
  { slug: "authority", label: "Authority" },
  { slug: "consultations", label: "Consultations" },
  { slug: "actions", label: "Actions" },
  { slug: "metrics", label: "Metrics" },
  { slug: "timeline", label: "Timeline" },
  { slug: "files", label: "Files" },
  { slug: "assistant", label: "Assistant" },
];

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Client sections" className="flex gap-1 overflow-x-auto border-b border-border px-6">
      {TABS.map((tab) => {
        const href = `/clients/${clientId}/${tab.slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${
              isActive
                ? "border-accent font-medium text-ink"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
