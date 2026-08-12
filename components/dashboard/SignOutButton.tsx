"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      loading={isPending}
      loadingText="Signing out…"
      className="px-3"
    >
      Sign out
    </Button>
  );
}
