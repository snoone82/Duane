import { test, expect } from "@playwright/test";
import {
  completeAllAuditAreas,
  createAccountOnCompleteScreen,
  getRevealedScore,
  selectLeverageArea,
  testPassword,
  uniqueTestEmail,
} from "./helpers";

/**
 * Covers the core audit journey end to end, as one continuous flow — the
 * acceptance tests below are inherently sequential (you can't sign back in
 * to an account that hasn't been created yet), so this is one test with
 * named steps rather than several independent tests re-doing setup work.
 * Each Playwright test gets its own fresh, isolated browser context (no
 * shared cookies/storage with any other test), which is what "start in a
 * private window" (acceptance test 1) means in practice.
 */
test("full audit journey: anonymous start → ten areas → leverage → score reveal → account → sign out/in", async ({
  page,
}) => {
  const email = uniqueTestEmail();
  const password = testPassword();
  let expectedScore = 0;

  await test.step("acceptance test 1: starts the audit from a fresh session with no signup required", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The Audit" })).toBeVisible();

    // No login/signup form anywhere on the landing page — just the one CTA.
    await expect(page.getByLabel(/email/i)).toHaveCount(0);
    await expect(page.getByLabel(/password/i)).toHaveCount(0);

    await page.getByRole("button", { name: /start the audit/i }).click();
    await page.waitForURL(/\/audit(\?.*)?$/);

    // Landed straight on the first life area — no account prompt in the way.
    await expect(page.getByText("1 of 10")).toBeVisible();
  });

  await test.step("acceptance test 3: completing all ten areas + the leverage question reveals a score equal to the sum of satisfaction ratings", async () => {
    const satisfactions = await completeAllAuditAreas(page);
    expect(satisfactions).toHaveLength(10);
    expectedScore = satisfactions.reduce((sum, s) => sum + s, 0);

    await selectLeverageArea(page, 0);
    await page.waitForURL(/\/audit\/complete$/);

    const revealedScore = await getRevealedScore(page);
    expect(revealedScore).toBe(expectedScore);
  });

  await test.step("acceptance test 4: creating an account at the end shows results immediately, no re-entry", async () => {
    await createAccountOnCompleteScreen(page, { fullName: "Ada E2E", email, password });

    // Landed on /dashboard with the same score already there — no login
    // step, no re-answering anything.
    await expect(page.getByText("Your Alignment Score")).toBeVisible();
    const dashboardScore = await getRevealedScore(page);
    expect(dashboardScore).toBe(expectedScore);

    // All ten areas are listed on the results page too.
    await expect(page.getByRole("listitem")).toHaveCount(10);
  });

  await test.step("acceptance test 5: signing out and back in still shows everything", async () => {
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("/");

    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/dashboard$/);

    await expect(page.getByText("Your Alignment Score")).toBeVisible();
    const scoreAfterSignIn = await getRevealedScore(page);
    expect(scoreAfterSignIn).toBe(expectedScore);
    await expect(page.getByRole("listitem")).toHaveCount(10);
  });
});
