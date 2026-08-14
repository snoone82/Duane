"use client";

import { useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/Input";
import { ACTION_STATUS } from "@/lib/status";

export function ActionsToolbar({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "all") params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select
        defaultValue={searchParams.get("status") ?? "not_done"}
        onChange={(event) => pushParams({ status: event.target.value })}
        className="w-40"
        aria-label="Filter by status"
      >
        <option value="not_done">Open + in progress</option>
        <option value="all">All statuses</option>
        {ACTION_STATUS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label} only
          </option>
        ))}
      </Select>
      <Select
        defaultValue={searchParams.get("client") ?? "all"}
        onChange={(event) => pushParams({ client: event.target.value })}
        className="w-48"
        aria-label="Filter by client"
      >
        <option value="all">All clients</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </Select>
      <Select
        defaultValue={searchParams.get("due") ?? "all"}
        onChange={(event) => pushParams({ due: event.target.value })}
        className="w-40"
        aria-label="Filter by due date"
      >
        <option value="all">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="this_week">Due this week</option>
        <option value="no_date">No due date</option>
      </Select>
      <Input
        type="search"
        placeholder="Filter by owner…"
        defaultValue={searchParams.get("owner") ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => pushParams({ owner: value }), 250);
        }}
        className="w-44"
        aria-label="Filter by owner"
      />
    </div>
  );
}
