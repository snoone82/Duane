import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

/** The front door gets the Deep Focus treatment (Duane's refresh): the
 * logo at full presence over a luminous teal-violet aurora, featherweight
 * title, and the form in a glass card — the same visual language as the
 * duanebryan.com direction he approved. */
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Aurora — stronger than the app shell's; this screen is the moment of arrival. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 8%, rgba(33, 201, 224, 0.18), transparent 65%), radial-gradient(820px 520px at 88% 95%, rgba(139, 92, 246, 0.16), transparent 60%), radial-gradient(600px 400px at 5% 80%, rgba(139, 92, 246, 0.08), transparent 60%)",
        }}
      />

      <div className="relative flex w-full max-w-md flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static local asset, next/image adds no value here */}
        <img src="/brand/logo-lockup.png" alt="Aligned Media" className="mb-8 h-16 w-auto md:h-20" />
        <h1 className="mb-2 text-center text-3xl font-light tracking-tight text-ink">
          Personal Brand <span className="bg-gradient-to-r from-accent to-[#8b5cf6] bg-clip-text font-normal text-transparent">OS</span>
        </h1>
        <p className="mb-8 text-center text-sm font-light text-ink-soft">
          Clarity. Alignment. Action. — sign in to your workspace.
        </p>

        <div
          className="w-full rounded-xl border bg-surface/80 p-6 backdrop-blur"
          style={{ borderColor: "rgba(33, 201, 224, 0.25)", boxShadow: "0 0 60px rgba(33, 201, 224, 0.12), 0 14px 34px rgba(0, 0, 0, 0.5)" }}
        >
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
