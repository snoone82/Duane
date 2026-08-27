"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The tab list arrives from the layout, already filtered by the signed-in
 * portal user's permissions (the principal client sees everything; client
 * team members see what their membership allows). */
export function PortalNav({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Portal sections" className="flex gap-1 overflow-x-auto border-b border-border bg-surface/50 px-4 backdrop-blur-md md:px-6">
      {tabs.map((tab) => {
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
