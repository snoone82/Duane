"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { initials } from "@/lib/format";
import { navItemsForRole } from "@/components/layout/nav-items";

export function Sidebar({ name, role }: { name: string; role: string }) {
  const pathname = usePathname();
  const navItems = navItemsForRole(role);

  return (
    <aside className="hidden h-dvh w-[--sidebar-width] flex-shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-[--topbar-height] items-center gap-2 border-b border-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
        <img src="/brand/icon-mark.png" alt="" className="h-6 w-auto flex-shrink-0" />
        <span className="truncate text-sm font-semibold tracking-tight text-ink">Personal Brand OS</span>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`block rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
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
            className="w-full rounded-md px-3 py-1.5 text-left text-sm text-ink-soft hover:bg-surface-muted hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
