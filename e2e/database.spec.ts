import { test, expect } from "@playwright/test";
import {
  completeAllAuditAreas,
  createAccountOnCompleteScreen,
  getRevealedScore,
  selectLeverageArea,
  testPassword,
  uniqueTestEmail,
} from "./helpers";
import { createTestSupabaseClient } from "./supabase-test-client";

/**
 * Direct-Supabase verification specs. These use the same anon key + RLS
 * posture as the real app (see e2e/supabase-test-client.ts) — never a
 * service-role key, which this project doesn't have anywhere.
 *
 * Note: acceptance test 8 signs back in with the email/password just used to
 * create the account, from a plain Node Supabase client (not the browser
 * session), so it can query as that same authenticated user. If the
 * Supabase project has Authentication → Providers → Email → "Confirm email"
 * turned on, that sign-in may fail until the confirmation link is clicked —
 * see README.md "Running the tests" and the "Decisions I made" section on
 * email confirmation. Turn "Confirm email" off for this project (or a test
 * project) to run this spec as written.
 */

test.describe("acceptance test 8: a completed audit produces exactly the rows the schema expects", () => {
  test("1 audits row + 10 audit_responses rows, each with satisfaction/importance/priority_score", async ({
    page,
  }) => {
    const email = uniqueTestEmail("db-test8");
    const password = testPassword();

    await page.goto("/");
    await page.getByRole("button", { name: /start the audit/i }).click();
    await page.waitForURL(/\/audit(\?.*)?$/);

    const satisfactions = await completeAllAuditAreas(page);
    const expectedTotal = satisfactions.reduce((sum, s) => sum + s, 0);

    await selectLeverageArea(page, 0);
    await page.waitForURL(/\/audit\/complete$/);

    const revealedScore = await getRevealedScore(page);
    expect(revealedScore).toBe(expectedTotal);

    await createAccountOnCompleteScreen(page, { fullName: "DB Verify", email, password });
    await expect(page.getByText("Your Alignment Score")).toBeVisible();

    // Re-authenticate as the same user from a plain Node Supabase client, so
    // the queries below run under that user's own RLS-scoped session —
    // exactly the same access the app itself would have, nothing more.
    const supabase = createTestSupabaseClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    expect(signInError, signInError?.message).toBeNull();
    expect(signInData.user).toBeTruthy();

    try {
      const { data: audits, error: auditsError } = await supabase
        .from("audits")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);

      expect(auditsError, auditsError?.message).toBeNull();
      expect(audits).toHaveLength(1);

      const audit = audits![0]!;
      expect(audit.total_score).toBe(expectedTotal);
      expect(audit.leverage_area_id).not.toBeNull();
      expect(audit.completed_at).not.toBeNull();

      const { data: responses, error: responsesError } = await supabase
        .from("audit_responses")
        .select("*")
        .eq("audit_id", audit.id);

      expect(responsesError, responsesError?.message).toBeNull();
      expect(responses).toHaveLength(10);

      const respondedTotal = (responses ?? []).reduce((sum, r) => sum + r.satisfaction_score, 0);
      expect(respondedTotal).toBe(expectedTotal);

      for (const response of responses ?? []) {
        expect(response.satisfaction_score).toBeGreaterThanOrEqual(1);
        expect(response.satisfaction_score).toBeLessThanOrEqual(10);
        expect(response.importance_score).toBeGreaterThanOrEqual(1);
        expect(response.importance_score).toBeLessThanOrEqual(5);
        // priority_score is a generated column: importance * (10 - satisfaction).
        expect(response.priority_score).toBe(
          response.importance_score * (10 - response.satisfaction_score)
        );
      }
    } finally {
      await supabase.auth.signOut();
    }
  });
});

test.describe("acceptance test 9: the database enforces importance_score's 1-5 range", () => {
  test("saving importance_score = 6 is rejected", async () => {
    const supabase = createTestSupabaseClient();

    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
    expect(signInError, signInError?.message).toBeNull();
    expect(signInData.user).toBeTruthy();

    try {
      const { data: audit, error: auditError } = await supabase
        .from("audits")
        .insert({ user_id: signInData.user!.id })
        .select("id")
        .single();
      expect(auditError, auditError?.message).toBeNull();
      expect(audit).toBeTruthy();

      const { data: lifeAreas, error: lifeAreasError } = await supabase
        .from("life_areas")
        .select("id")
        .eq("is_active", true)
        .limit(1);
      expect(lifeAreasError, lifeAreasError?.message).toBeNull();
      expect(lifeAreas?.length ?? 0).toBeGreaterThan(0);

      const { error: insertError } = await supabase.from("audit_responses").insert({
        audit_id: audit!.id,
        life_area_id: lifeAreas![0]!.id,
        satisfaction_score: 5,
        importance_score: 6, // out of range: the schema's check constraint is 1-5
      });

      expect(insertError, "expected the insert to be rejected by the check constraint").not.toBeNull();
      expect(insertError!.message.toLowerCase()).toMatch(/check|constraint|range|violat/);

      // And confirm nothing was actually written.
      const { data: responses, error: responsesError } = await supabase
        .from("audit_responses")
        .select("id")
        .eq("audit_id", audit!.id);
      expect(responsesError, responsesError?.message).toBeNull();
      expect(responses).toHaveLength(0);
    } finally {
      await supabase.auth.signOut();
    }
  });
});
