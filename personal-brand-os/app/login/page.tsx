import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="mb-4 h-10 w-auto" />
        <h1 className="mb-1 text-lg font-semibold text-ink">Personal Brand OS</h1>
        <p className="mb-6 text-sm text-ink-soft">Sign in to Aligned Media&rsquo;s client workspace.</p>
        <LoginForm />
      </div>
    </div>
  );
}
