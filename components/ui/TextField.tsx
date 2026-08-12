"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /**
   * Show a show/hide toggle button inside the field. Defaults to `true`
   * whenever `type="password"` — near-universal baseline UX at this point —
   * so any password field gets it automatically without callers having to
   * opt in. Pass `false` to suppress it for a password field that genuinely
   * shouldn't have one.
   */
  showToggle?: boolean;
}

/**
 * Eye / eye-off toggle icons, inline rather than pulling in an icon library
 * for two glyphs. Sized to sit comfortably inside the field's 44px
 * (--tap-target-min) tap target without dominating it.
 */
function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.3 5.7C1.7 6.6 1.5 10 1.5 10S4.5 16 10 16c1.13 0 2.16-.25 3.06-.63M16.2 13.9c1.4-1.35 2.3-3.9 2.3-3.9s-3-6-8.5-6c-.5 0-.98.05-1.44.14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.9 8.3a2.25 2.25 0 0 0 3.18 3.18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 2.5l15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TextField({ label, hint, id, type, className = "", showToggle, ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const isPassword = type === "password";
  const hasToggle = isPassword && (showToggle ?? true);
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={hasToggle ? (visible ? "text" : "password") : type}
          className={`min-h-[var(--tap-target-min)] w-full rounded-md border border-border bg-paper-raised px-4 text-base text-ink placeholder:text-ink-faint focus:border-gold ${
            hasToggle ? "pr-[var(--tap-target-min)]" : ""
          } ${className}`}
          {...props}
        />
        {hasToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-[var(--tap-target-min)] items-center justify-center text-ink-faint transition-colors duration-[var(--duration-fast)] hover:text-ink-soft"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
