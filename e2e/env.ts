import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Loads .env.local into process.env for the Playwright test process.
 *
 * The app itself relies on Next.js loading .env.local automatically
 * (lib/env.ts); the Playwright test runner is a separate Node process that
 * doesn't get that for free. This project deliberately has no `dotenv`
 * dependency (see README.md — kept dependency-free beyond @playwright/test),
 * so this is a small manual parser rather than a new package. Only fills in
 * values that aren't already set, so CI can supply real env vars instead of
 * a checked-in file.
 *
 * Imported for its side effect by e2e/supabase-test-client.ts — import this
 * module before reading NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY from
 * process.env anywhere in the e2e suite.
 */
let loaded = false;

export function loadDotEnvLocal(): void {
  if (loaded) return;
  loaded = true;

  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf-8");
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Strip a single layer of matching quotes, same as most .env parsers.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();
