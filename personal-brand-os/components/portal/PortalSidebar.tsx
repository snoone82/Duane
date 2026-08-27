"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { initials } from "@/lib/format";

export interface PortalNavItem {
  href: string;
  label: string;
}

/** The portal's left-hand navigation — the same shell as the admin
 * workspace (Duane: "same product, same quality, different information").
 * Desktop: fixed sidebar. Phones: the identical hamburger drawer. */
function NavList({ items, pathname }: { items: PortalNavItem[]; pathname: string }) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`block rounded-md px-4 py-2.5 text-[15px] transition-colors duration-150 ${
              isActive
                ? "bg-accent-soft font-medium text-accent-strong shadow-[0_0_18px_rgba(33,201,224,0.12)]"
                : "text-ink-soft hover:bg-surface-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function AccountFooter({ clientName, personName }: { clientName: string; personName: string }) {
  return (
    <div className="border-t border-border p-4">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong">
          {initials(personName || clientName) || "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{personName || clientName}</p>
          <p className="truncate text-xs text-ink-faint">{clientName}</p>
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
  );
}

export function PortalSidebar({
  items,
  clientName,
  personName,
}: {
  items: PortalNavItem[];
  clientName: string;
  personName: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-dvh w-[--sidebar-width] flex-shrink-0 flex-col border-r border-border bg-surface backdrop-blur-md md:flex">
      <div className="flex h-[--topbar-height] items-center gap-3 border-b border-border px-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="h-9 w-auto" />
      </div>
      <nav aria-label="Portal sections" className="flex-1 space-y-2 overflow-y-auto p-4 pt-5">
        <NavList items={items} pathname={pathname} />
      </nav>
      <AccountFooter clientName={clientName} personName={personName} />
    </aside>
  );
}

export function PortalMobileHeader({
  items,
  clientName,
  personName,
}: {
  items: PortalNavItem[];
  clientName: string;
  personName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-3 backdrop-blur-md">
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
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="h-7 w-auto" />
      </header>

      {isOpen && (
        <div className="fixed inset-0 top-14 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl">
            <nav aria-label="Portal sections" className="flex-1 space-y-1.5 overflow-y-auto p-4">
              <NavList items={items} pathname={pathname} />
            </nav>
            <AccountFooter clientName={clientName} personName={personName} />
          </div>
        </div>
      )}
    </div>
  );
}
