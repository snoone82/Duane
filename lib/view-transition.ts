/**
 * Wraps a client-side navigation in the native View Transitions API
 * (`document.startViewTransition`) for a soft cross-fade between audit
 * steps, progressively enhanced:
 *
 * - Feature-detected, not UA-sniffed — browsers without support just get
 *   the plain instant navigation they already had.
 * - Explicitly checks `prefers-reduced-motion` via `matchMedia` and skips
 *   straight to the plain navigation when it's set. The global
 *   `prefers-reduced-motion` override in styles/design-tokens.css collapses
 *   CSS animation/transition durations to ~0, but it has no effect on the
 *   View Transitions API itself (which isn't a CSS animation/transition in
 *   the sense that rule targets) — so this needs its own explicit check.
 *
 * The transition itself is a plain cross-fade — see the
 * `::view-transition-old(root)` / `::view-transition-new(root)` rules in
 * app/globals.css, which only adjust timing/easing to match the app's
 * motion tokens. No slide, no zoom: this is a life-audit app, not a
 * marketing site, so restraint matters more than cleverness here.
 *
 * Note: Next.js App Router navigation is asynchronous (it fetches the next
 * route's payload before swapping content), while `startViewTransition`'s
 * callback is treated as synchronous unless it returns a promise that
 * resolves once the DOM has actually updated. `router.push` doesn't expose
 * that. In practice the browser still produces a soft cross-fade once the
 * new route's content commits — this is the same trade-off most Next.js
 * App Router + View Transitions integrations make until Next exposes a
 * first-class hook for it.
 */
export function navigateWithTransition(navigate: () => void): void {
  const supportsViewTransitions =
    typeof document !== "undefined" &&
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!supportsViewTransitions || prefersReducedMotion) {
    navigate();
    return;
  }

  (document as Document & { startViewTransition: (callback: () => void) => void }).startViewTransition(() => {
    navigate();
  });
}
