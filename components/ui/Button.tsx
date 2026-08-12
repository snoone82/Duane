import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 min-h-[var(--tap-target-min)] px-6 rounded-md font-body text-base font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-gold text-gold-ink hover:bg-gold-strong",
  secondary: "bg-transparent text-ink border border-border-strong hover:bg-paper-muted",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-paper-muted",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  /** Text shown while `loading` is true. Defaults to "Saving…" — override
   * this for buttons that don't actually save anything (signing in, signing
   * out, creating an account), so the label matches what's really happening. */
  loadingText?: string;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingText = "Saving…",
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? loadingText : children}
    </button>
  );
}
