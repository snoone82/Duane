import { expect, type Page } from "@playwright/test";

/**
 * Shared helpers for the Aligned e2e suite. These drive the app exactly the
 * way a real visitor would — through visible roles/labels/text, never by
 * reaching into implementation details — so they stay valid as the visual
 * design changes.
 */

/** A unique, obviously-fake email for each test run, so re-running the suite never collides with a previous run's account. */
export function uniqueTestEmail(prefix = "e2e"): string {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${stamp}@aligned-e2e.test`;
}

export function testPassword(): string {
  return "Correct-Horse-Battery-Staple-8";
}

/**
 * Clicks "Start the Audit" on the landing page, reads through the intro
 * screen (the scoring guide / "before you begin" framing), and clicks
 * "Begin the Audit" — landing on /audit at the first life area. This is the
 * real path a cold visitor takes now; call `page.goto("/")` first. Resuming
 * an in-progress audit ("Continue the Audit") skips the intro entirely and
 * isn't covered by this helper.
 */
export async function startFreshAudit(page: Page): Promise<void> {
  await page.getByRole("button", { name: /start the audit/i }).click();
  await page.waitForURL(/\/audit\/intro$/);
  await expect(page.getByRole("heading", { name: "The Aligned Audit" })).toBeVisible();

  await page.getByRole("button", { name: /begin the audit/i }).click();
  await page.waitForURL(/\/audit(\?.*)?$/);
}

/**
 * Answers every currently-unanswered life area on /audit, in order, using
 * the given (or default) satisfaction/importance generators, clicking
 * Continue after each. Stops as soon as the app navigates to
 * /audit/leverage (AuditAreaClient does this itself once the last area is
 * saved). Returns the satisfaction scores actually submitted, in area
 * order, so a caller can independently verify total_score == their sum
 * (acceptance test: "score = sum of satisfaction ratings").
 */
export async function completeAllAuditAreas(
  page: Page,
  options?: {
    satisfactionFor?: (index: number) => number;
    importanceFor?: (index: number) => number;
  }
): Promise<number[]> {
  const satisfactionFor = options?.satisfactionFor ?? ((i: number) => 1 + (i % 10));
  const importanceFor = options?.importanceFor ?? ((i: number) => 1 + (i % 5));

  const satisfactions: number[] = [];
  let index = 0;

  while (!/\/audit\/leverage/.test(page.url())) {
    if (index > 10) {
      throw new Error(
        "completeAllAuditAreas: still on /audit after 10 areas — the app may not be " +
          "navigating to /audit/leverage as expected."
      );
    }

    await expect(page.locator("h1")).toBeVisible();

    const satisfaction = satisfactionFor(index);
    const importance = importanceFor(index);

    const satisfactionGroup = page.getByRole("radiogroup", { name: /how it is right now/i });
    const satisfactionRadio = satisfactionGroup.getByRole("radio", { name: String(satisfaction), exact: true });
    await satisfactionRadio.click();
    await expect(satisfactionRadio).toHaveAttribute("aria-checked", "true");

    const importanceGroup = page.getByRole("radiogroup", { name: /how much it matters/i });
    const importanceRadio = importanceGroup.getByRole("radio", { name: String(importance), exact: true });
    await importanceRadio.click();
    await expect(importanceRadio).toHaveAttribute("aria-checked", "true");

    satisfactions.push(satisfaction);

    // `waitForLoadState('networkidle')` does not reliably signal "this
    // Next.js client-side navigation has landed" — App Router's RSC fetches
    // don't always align with the browser's network-idle notion, especially
    // under dev-mode's on-demand compilation. Waiting on it (or on a fixed
    // delay) let a later iteration start reading/clicking the *previous*
    // area's still-mounted DOM a beat before the real navigation swapped it
    // out — the click "succeeded" against content that was about to be
    // destroyed, so the actually-intended area was never answered. Wait for
    // the one concrete signal that means the swap really happened: the URL
    // itself changing away from the one we were on.
    const urlBeforeContinue = page.url();
    const continueButton = page.getByRole("button", { name: /continue/i });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await page.waitForURL((url) => url.toString() !== urlBeforeContinue);
    await expect(page.locator("h1")).toBeVisible();
    index += 1;
  }

  return satisfactions;
}

/** Selects the life area at `index` (0-based) on /audit/leverage and continues to /audit/complete. */
export async function selectLeverageArea(page: Page, index = 0): Promise<void> {
  await expect(page.locator("h1")).toContainText(/which would help the others most/i);

  const options = page.getByRole("radio");
  await options.nth(index).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/audit\/complete$/);
}

/** Reads the revealed Alignment Score off /audit/complete (or /dashboard) via the ScoreRing's accessible label, once the reveal has finished. */
export async function getRevealedScore(page: Page): Promise<number> {
  const scoreRing = page.getByRole("img", { name: /Alignment score \d+ out of \d+/i });
  await expect(scoreRing).toBeVisible();

  const label = await scoreRing.getAttribute("aria-label");
  const match = label?.match(/Alignment score (\d+) out of \d+/);
  if (!match) {
    throw new Error(`getRevealedScore: could not parse a score out of aria-label "${label}"`);
  }
  return Number(match[1]);
}

/** Fills and submits the account-creation form on /audit/complete, and waits for the resulting /dashboard navigation. */
export async function createAccountOnCompleteScreen(
  page: Page,
  { fullName, email, password }: { fullName: string; email: string; password: string }
): Promise<void> {
  await page.getByLabel("Name", { exact: true }).fill(fullName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create my account/i }).click();
  await page.waitForURL(/\/dashboard$/);
}

/** Asserts the currently-focused element has a visible focus outline (the app's global :focus-visible rule in styles/design-tokens.css), i.e. keyboard focus is never invisible. */
export async function expectFocusVisible(page: Page): Promise<void> {
  const hasVisibleOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const style = window.getComputedStyle(el);
    return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
  });
  expect(hasVisibleOutline, "expected the focused element to have a visible :focus-visible outline").toBe(true);
}

/** Presses Tab repeatedly (up to maxSteps) until `predicate` resolves true, checking before each press so an already-satisfied predicate needs zero tabs. Used for full-keyboard passes where exact tab-stop counts would be brittle to lay out by hand. */
export async function tabUntil(
  page: Page,
  predicate: () => Promise<boolean>,
  maxSteps = 40
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    if (await predicate()) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`tabUntil: predicate never became true within ${maxSteps} Tab presses`);
}

/** True once document.activeElement sits inside an element whose accessible name (aria-label) matches `pattern`. Excludes document.body — before the first real Tab press (or right after a navigation, before anything is auto-focused), activeElement defaults to body, which must never count as "focused". */
export function focusedWithinLabel(page: Page, pattern: RegExp): () => Promise<boolean> {
  return () =>
    page.evaluate((source) => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const container = el.closest("[aria-label]");
      const label = container?.getAttribute("aria-label") ?? "";
      return new RegExp(source.pattern, source.flags).test(label);
    }, { pattern: pattern.source, flags: pattern.flags });
}

/**
 * True once document.activeElement's own accessible text matches `pattern`
 * — for buttons/links rather than radiogroup members.
 *
 * Excludes document.body for the same reason as focusedWithinLabel above —
 * but here it's not just a safety guard: without it this predicate is
 * actively wrong. body.textContent concatenates the *entire page's* text,
 * so on a fresh page (nothing focused yet, activeElement === body) a
 * pattern like /start the audit/i matches immediately against the whole
 * page's text, before any Tab press — tabUntil then believes it's already
 * on the target and stops, leaving focus nowhere. Caught by acceptance
 * test 7 failing on the very first focus-visible check.
 */
export function focusedTextMatches(page: Page, pattern: RegExp): () => Promise<boolean> {
  return () =>
    page.evaluate((source) => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      return new RegExp(source.pattern, source.flags).test(text);
    }, { pattern: pattern.source, flags: pattern.flags });
}
