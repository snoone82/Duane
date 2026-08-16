"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Input";
import { setUserRole } from "@/lib/actions/roles";
import type { ProfileRole } from "@/lib/enums";

const ROLE_OPTIONS: { value: ProfileRole; label: string }[] = [
  { value: "admin", label: "Admin — full access" },
  { value: "member", label: "Member — assigned clients" },
  { value: "contractor", label: "Contractor — assigned clients, no strategy" },
  { value: "client", label: "Client — portal only" },
];

export function RoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: ProfileRole;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Select
        aria-label="Role"
        value={currentRole}
        disabled={disabled || isPending}
        onChange={(e) => {
          const role = e.target.value as ProfileRole;
          setError(null);
          startTransition(async () => {
            const result = await setUserRole(userId, role);
            if (!result.ok) setError(result.message);
          });
        }}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
