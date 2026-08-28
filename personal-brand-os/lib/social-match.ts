/**
 * Resolving a written account name ("LinkedIn — Daniel Andrews") to the
 * real Social record.
 *
 * The import template asks the AI for the account's full label, so the
 * importer has to accept that shape as well as a bare account name, and
 * survive the usual drift: different dash characters, stray whitespace,
 * inconsistent capitalisation, "LinkedIn - CEG" vs "LinkedIn — CEG".
 *
 * Ambiguity is deliberately not guessed. Daniel has both "LinkedIn —
 * Daniel Andrews" and "Instagram — Daniel Andrews", so a bare "Daniel
 * Andrews" matches nothing on its own — but the full label, or a bare name
 * plus the output's own platform, resolves cleanly.
 */

export interface MatchableAccount {
  platform: string;
  account_name: string;
}

/** Lowercase, unify every dash/punctuation variant to a space, collapse
 * whitespace — so "LinkedIn — Daniel  Andrews" and "linkedin-daniel
 * andrews" become the same key. */
export function normaliseAccountKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface AccountResolver<T> {
  /** The matching account, or undefined when there's no unambiguous match.
   * `platformHint` is the output's own platform field, used to
   * disambiguate a bare account name. */
  (value: string | null | undefined, platformHint?: string | null): T | undefined;
}

export function buildAccountResolver<T extends MatchableAccount>(accounts: T[]): AccountResolver<T> {
  const byKey = new Map<string, T>();
  const ambiguous = new Set<string>();

  const add = (raw: string, account: T) => {
    const key = normaliseAccountKey(raw);
    if (!key) return;
    const existing = byKey.get(key);
    if (existing && existing !== account) {
      ambiguous.add(key);
      return;
    }
    byKey.set(key, account);
  };

  for (const account of accounts) {
    if (account.account_name.trim()) {
      // "LinkedIn — Daniel Andrews" and "Daniel Andrews"
      add(`${account.platform} ${account.account_name}`, account);
      add(account.account_name, account);
    }
  }

  // A bare platform name resolves only when that platform has exactly one
  // account on this client — otherwise it stays unmatched.
  const perPlatform = new Map<string, T[]>();
  for (const account of accounts) {
    const key = normaliseAccountKey(account.platform);
    perPlatform.set(key, [...(perPlatform.get(key) ?? []), account]);
  }
  for (const [key, list] of perPlatform) {
    if (list.length === 1 && !byKey.has(key) && list[0]) byKey.set(key, list[0]);
  }

  return (value, platformHint) => {
    if (!value || !value.trim()) return undefined;
    const key = normaliseAccountKey(value);
    if (key && !ambiguous.has(key)) {
      const hit = byKey.get(key);
      if (hit) return hit;
    }
    // Bare name that's ambiguous on its own — the output's platform settles it.
    if (platformHint && platformHint.trim()) {
      const combined = normaliseAccountKey(`${platformHint} ${value}`);
      if (combined && !ambiguous.has(combined)) return byKey.get(combined);
    }
    return undefined;
  };
}
