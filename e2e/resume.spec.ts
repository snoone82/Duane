import { test, expect } from "@playwright/test";

/**
 * Acceptance test 2: answer three areas, close the tab, reopen it, and the
 * audit resumes at area four with the first three answers intact.
 *
 * "Close tab, reopen" is modelled as: save the browser context's storage
 * state (this is where the Supabase anonymous session cookie lives — the
 * same mechanism a real reopened tab relies on), close the context, then
 * open a brand new context seeded with that storage state and navigate back
 * to /audit. That's a closer match to "the same browser, later" than simply
 * reusing one `page` object, which never actually loses in-memory state.
 */
test("acceptance test 2: closing and reopening the tab resumes at area 4 with the first three areas intact", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/");
  await page.getByRole("button", { name: /start the audit/i }).click();
  await page.waitForURL(/\/audit(\?.*)?$/);

  const answers = [
    { satisfaction: 3, importance: 2 },
    { satisfaction: 7, importance: 5 },
    { satisfaction: 1, importance: 3 },
  ];

  for (const { satisfaction, importance } of answers) {
    await page
      .getByRole("radiogroup", { name: /how it is right now/i })
      .getByRole("radio", { name: String(satisfaction), exact: true })
      .click();
    await page
      .getByRole("radiogroup", { name: /how much it matters/i })
      .getByRole("radio", { name: String(importance), exact: true })
      .click();

    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  await expect(page.getByText("4 of 10")).toBeVisible();

  // "Close the tab" — persist the session (cookies) the same way a real
  // browser would keep it, then tear the page/context down entirely.
  const storageState = await context.storageState();
  await page.close();
  await context.close();

  // "Reopen it" — a fresh context/page seeded with that same session.
  const reopenedContext = await browser.newContext({ storageState });
  const reopenedPage = await reopenedContext.newPage();

  await reopenedPage.goto("/audit");
  await expect(reopenedPage.getByText("4 of 10")).toBeVisible();

  // Step back through the first three areas and confirm each answer is
  // still exactly what was saved before the tab closed.
  for (let i = 0; i < answers.length; i++) {
    await reopenedPage.getByRole("button", { name: /^back$/i }).click();
  }
  await expect(reopenedPage.getByText("1 of 10")).toBeVisible();

  for (let i = 0; i < answers.length; i++) {
    const { satisfaction, importance } = answers[i];

    await expect(
      reopenedPage
        .getByRole("radiogroup", { name: /how it is right now/i })
        .getByRole("radio", { name: String(satisfaction), exact: true })
    ).toHaveAttribute("aria-checked", "true");

    await expect(
      reopenedPage
        .getByRole("radiogroup", { name: /how much it matters/i })
        .getByRole("radio", { name: String(importance), exact: true })
    ).toHaveAttribute("aria-checked", "true");

    if (i < answers.length - 1) {
      await reopenedPage.getByRole("button", { name: /^continue$/i }).click();
      await reopenedPage.waitForLoadState("networkidle").catch(() => {});
    }
  }

  await reopenedContext.close();
});
