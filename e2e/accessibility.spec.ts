import { test, expect, type Page } from "@playwright/test";
import {
  completeAllAuditAreas,
  expectFocusVisible,
  focusedTextMatches,
  focusedWithinLabel,
  selectLeverageArea,
  tabUntil,
} from "./helpers";

const TAP_TARGET_MIN_PX = 44; // --tap-target-min, styles/design-tokens.css

async function assertNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "page should not scroll horizontally").toBeLessThanOrEqual(clientWidth);
}

async function assertNoTapTargetUndersized(page: Page, minPx = TAP_TARGET_MIN_PX) {
  const undersized = await page.evaluate((min) => {
    const selector = 'button, a[href], input, textarea, [role="radio"], [role="button"]';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const bad: string[] = [];

    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue; // not actually rendered

      // Allow half a pixel of rounding slack.
      if (rect.height < min - 0.5 || rect.width < min - 0.5) {
        const label = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 40);
        bad.push(`<${el.tagName.toLowerCase()}> "${label}" ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}px`);
      }
    }
    return bad;
  }, minPx);

  expect(undersized, `elements under ${minPx}px:\n${undersized.join("\n")}`).toEqual([]);
}

test.describe("acceptance test 6: mobile viewport — no horizontal scroll, no tap target under 44px", () => {
  // Mobile device emulation (viewport, touch, UA) is applied at the project
  // level — see the "mobile-chrome" project in playwright.config.ts, which
  // targets this file specifically. Running under "desktop-chrome" too is
  // intentional: the layout must be scroll/tap-target safe at both sizes.

  test("landing page", async ({ page }) => {
    await page.goto("/");
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page);
  });

  test("audit intro, audit area, leverage question and score-reveal/signup screens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /start the audit/i }).click();
    await page.waitForURL(/\/audit\/intro$/);
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page); // the scoring guide rows + Begin button

    await page.getByRole("button", { name: /begin the audit/i }).click();
    await page.waitForURL(/\/audit(\?.*)?$/);
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page);

    await completeAllAuditAreas(page);
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page); // the ten single-select leverage rows

    await selectLeverageArea(page, 0);
    await page.waitForURL(/\/audit\/complete$/);
    // Wait for the score reveal + signup form (name/email/password) to render.
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page); // includes the new password show/hide toggle
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await assertNoHorizontalScroll(page);
    await assertNoTapTargetUndersized(page);
  });
});

test.describe("acceptance test 7: full keyboard-only pass through the audit, focus always visible", () => {
  test("tabbing and Enter/Space alone can complete the whole audit", async ({ page }) => {
    await page.goto("/");

    await tabUntil(page, focusedTextMatches(page, /start the audit/i));
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/audit\/intro$/);

    // The intro screen has exactly one interactive control — tab to it and
    // begin, same as a real keyboard-only visitor would.
    await tabUntil(page, focusedTextMatches(page, /begin the audit/i));
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/audit(\?.*)?$/);

    let index = 0;
    while (!/\/audit\/leverage/.test(page.url())) {
      if (index > 10) throw new Error("keyboard pass: never reached /audit/leverage");

      await tabUntil(page, focusedWithinLabel(page, /how it is right now/i));
      await expectFocusVisible(page);
      await page.keyboard.press("Enter"); // selects whichever satisfaction option currently has focus

      await tabUntil(page, focusedWithinLabel(page, /how much it matters/i));
      await expectFocusVisible(page);
      await page.keyboard.press("Enter"); // selects whichever importance option currently has focus

      await tabUntil(page, focusedTextMatches(page, /continue/i));
      await expectFocusVisible(page);
      // See the matching comment in e2e/helpers.ts's completeAllAuditAreas —
      // wait for the URL to actually change rather than trusting
      // networkidle, or the next loop iteration starts tabbing through the
      // still-mounted previous area right as it's being swapped out.
      const urlBeforeContinue = page.url();
      await page.keyboard.press("Enter");
      await page.waitForURL((url) => url.toString() !== urlBeforeContinue);
      await expect(page.locator("h1")).toBeVisible();

      index += 1;
    }

    // Leverage question: tab to the first option and select it with the keyboard.
    await tabUntil(page, async () => {
      const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
      return role === "radio";
    });
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");

    await tabUntil(page, focusedTextMatches(page, /continue/i));
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/audit\/complete$/);

    // Score reveal + signup form: tab through Name / Email / Password
    // (including the new show/hide toggle button that now sits inside tab
    // order right after the password field) and submit with the keyboard.
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

    await tabUntil(page, async () => (await page.evaluate(() => document.activeElement?.id)) === "fullName");
    await expectFocusVisible(page);
    await page.keyboard.type("Keyboard Only");

    await tabUntil(page, async () => (await page.evaluate(() => document.activeElement?.id)) === "email");
    await expectFocusVisible(page);
    await page.keyboard.type(`keyboard-only-${Date.now()}@aligned-e2e.test`);

    await tabUntil(page, async () => (await page.evaluate(() => document.activeElement?.id)) === "password");
    await expectFocusVisible(page);
    await page.keyboard.type("Keyboard-Only-Pass-8");

    await tabUntil(page, focusedTextMatches(page, /create my account/i));
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");

    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("Your Alignment Score")).toBeVisible();
  });
});

test.describe("password visibility toggle — components/ui/TextField.tsx", () => {
  test("is keyboard-accessible and toggles the input's type + its own label", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.getByLabel("Password", { exact: true });
    await passwordInput.fill("some-password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    const toggle = page.getByRole("button", { name: "Show password" });
    await expect(toggle).toBeVisible();

    // Reachable by keyboard, not just mouse: tab from the password field
    // lands on the toggle (a real <button>, so it's a native tab stop).
    await passwordInput.focus();
    await page.keyboard.press("Tab");
    await expectFocusVisible(page);
    const focusedIsToggle = await page.evaluate(
      () => document.activeElement?.getAttribute("aria-label") === "Show password"
    );
    expect(focusedIsToggle).toBe(true);

    await page.keyboard.press("Enter");
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();

    // Clicking works too, and flips the label/type back.
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
