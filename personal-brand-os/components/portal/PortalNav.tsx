"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal", label: "Strategy" },
  { href: "/portal/signoff", label: "Sign-off" },
  { href: "/portal/priorities", label: "Priorities" },
  { href: "/portal/content", label: "Content" },
  { href: "/portal/progress", label: "Progress" },
  { href: "/portal/meetings", label: "Meetings" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal sections" className="flex gap-1 overflow-x-auto border-b border-border px-6">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${
              isActive ? "border-accent font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
