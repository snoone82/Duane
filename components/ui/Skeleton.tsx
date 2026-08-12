/**
 * A single loading placeholder block — a subtle pulse, not a spinner.
 * Uses Tailwind's built-in `animate-pulse` (a CSS animation, not a JS
 * interval), so it's already covered by the global
 * `prefers-reduced-motion` override in styles/design-tokens.css, which
 * forces all animation/transition durations to ~0 for users who ask for it.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-paper-muted ${className}`} />;
}
