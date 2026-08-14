"use client";

import { useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/Input";
import { CLIENT_STATUS } from "@/lib/status";
import { AddClientButton } from "@/components/clients/AddClientButton";

export function ClientsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search by name…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => pushParams({ q: value }), 250);
          }}
          className="w-56"
          aria-label="Search clients by name"
        />
        <Select
          defaultValue={searchParams.get("status") ?? "all"}
          onChange={(event) => pushParams({ status: event.target.value })}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {CLIENT_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <AddClientButton />
    </div>
  );
}
