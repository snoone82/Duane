"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Global search box, present in the top bar on every page (brief §4.6).
 * "/" focuses it from anywhere unless the user is already typing in a field
 * — the one keyboard shortcut the brief asks for.
 */
export function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Don't retain a stale query across unrelated navigations.
  useEffect(() => {
    if (pathname !== "/search" && inputRef.current) inputRef.current.value = "";
  }, [pathname]);

  return (
    <form
      role="search"
      action="/search"
      className="w-full max-w-sm"
      onSubmit={(event) => {
        const value = inputRef.current?.value.trim();
        if (!value) event.preventDefault();
      }}
    >
      <label htmlFor="global-search" className="sr-only">
        Search clients, content, authority, consultations, actions and pillars
      </label>
      <input
        ref={inputRef}
        id="global-search"
        name="q"
        type="search"
        placeholder="Search…  (press /)"
        defaultValue=""
        onKeyDown={(event) => {
          if (event.key === "Enter") router.push(`/search?q=${encodeURIComponent(event.currentTarget.value)}`);
        }}
        className="h-[--control-height] w-full rounded-md border border-border bg-surface-muted px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 focus:border-accent focus:bg-surface"
      />
    </form>
  );
}
