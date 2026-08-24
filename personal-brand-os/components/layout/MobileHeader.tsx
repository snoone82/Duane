"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { initials } from "@/lib/format";
import { navItemsForRole } from "@/components/layout/nav-items";

/** Duane's mobile feedback: on a phone the sidebar swallowed the screen.
 * Below md the sidebar is hidden entirely and this compact header takes
 * over — a hamburger that opens a slide-over drawer with the same nav. */
export function MobileHeader({ name, role }: { name: string; role: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the drawer — the whole point of tapping a link.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const navItems = navItemsForRole(role);

  return (
    <div className="md:hidden">
      <header className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <button
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft hover:bg-surface-muted hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {isOpen ? (
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
        <img src="/brand/icon-mark.png" alt="" className="h-5 w-auto flex-shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight text-ink">Personal Brand OS</span>
      </header>

      {isOpen && (
        <div className="fixed inset-0 top-12 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl">
            <nav aria-label="Primary" className="flex-1 space-y-0.5 overflow-y-auto p-2">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                      isActive
                        ? "bg-accent-soft font-medium text-accent-strong"
                        : "text-ink-soft hover:bg-surface-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-3">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
                  {initials(name) || "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{name}</p>
                  <p className="truncate text-xs capitalize text-ink-faint">{role}</p>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-surface-muted hover:text-ink"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
