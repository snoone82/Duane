/**
 * Matching a batch of MP4s to the content records being imported.
 *
 * Duane: "PBOS matches each MP4 to the correct imported content item using
 * the Clip ID / filename. It shouldn't guess if a filename/Clip ID doesn't
 * match." So this is deliberately strict — every rule here exists to refuse
 * a match rather than to find one.
 *
 * The matching rule: split both the clip id and the filename into
 * alphanumeric tokens, and match only when the clip's tokens appear as a
 * CONSECUTIVE run in the filename's tokens.
 *
 *   JG-S10-C03   →  [JG, S10, C03]
 *   JG-S10-C03_final_v2.mp4  →  [JG, S10, C03, FINAL, V2]   ✓ matched
 *   final JG S10 C03.mov     →  [FINAL, JG, S10, C03]       ✓ matched
 *   JG-S10-C030.mp4          →  [JG, S10, C030]             ✗ not matched
 *
 * That last one is the reason for tokens rather than a substring test:
 * "JGS10C03" is a prefix of "JGS10C030", so a plain `includes` would happily
 * attach clip 3's video to clip 30. Tokenising makes C03 and C030 different
 * things, which is the whole point of having a permanent id.
 *
 * Pure — no DB, no browser APIs — so the form can run it as files are
 * chosen and the server can re-check the same way.
 */

export interface ClipCandidate {
  /** Index into the parsed ideas array, so a title can repeat safely. */
  index: number;
  title: string;
  clipId: string | null;
}

export type ClipMatchState =
  | { state: "matched"; fileName: string }
  /** The JSON gave a clip id but nothing selected carries it. */
  | { state: "no_file" }
  /** More than one file claims this clip — never guessed between. */
  | { state: "ambiguous_files"; fileNames: string[] }
  /** The record has no clip id, so there is nothing to match on. */
  | { state: "no_clip_id" };

export interface ClipMatchRow extends ClipCandidate {
  match: ClipMatchState;
}

export interface ClipMatchReport {
  rows: ClipMatchRow[];
  /** Files that matched no record at all. */
  unusedFiles: string[];
  /** Files matching more than one record — never attached to either. */
  ambiguousFiles: { fileName: string; clipIds: string[] }[];
  matchedCount: number;
}

/** Drop the extension, then split on anything that isn't a letter or digit. */
export function tokenise(value: string): string[] {
  const withoutExtension = value.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  return withoutExtension
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Does `clipTokens` appear as a consecutive run inside `fileTokens`? */
function containsRun(fileTokens: string[], clipTokens: string[]): boolean {
  if (clipTokens.length === 0 || clipTokens.length > fileTokens.length) return false;
  for (let start = 0; start <= fileTokens.length - clipTokens.length; start += 1) {
    let all = true;
    for (let offset = 0; offset < clipTokens.length; offset += 1) {
      if (fileTokens[start + offset] !== clipTokens[offset]) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

export function matchClipsToFiles(candidates: ClipCandidate[], fileNames: string[]): ClipMatchReport {
  const fileTokens = fileNames.map((name) => ({ name, tokens: tokenise(name) }));

  // Every (record, file) pair that matches, before deciding anything. A
  // match is only usable when it's the single pair on BOTH sides.
  const hits = new Map<number, string[]>();
  const filesToClips = new Map<string, string[]>();

  for (const candidate of candidates) {
    const clipTokens = candidate.clipId ? tokenise(candidate.clipId) : [];
    if (clipTokens.length === 0) continue;
    for (const file of fileTokens) {
      if (!containsRun(file.tokens, clipTokens)) continue;
      hits.set(candidate.index, [...(hits.get(candidate.index) ?? []), file.name]);
      filesToClips.set(file.name, [...(filesToClips.get(file.name) ?? []), candidate.clipId!]);
    }
  }

  const ambiguousFiles = [...filesToClips.entries()]
    .filter(([, clipIds]) => clipIds.length > 1)
    .map(([fileName, clipIds]) => ({ fileName, clipIds }));
  const ambiguousFileNames = new Set(ambiguousFiles.map((f) => f.fileName));

  let matchedCount = 0;
  const usedFiles = new Set<string>();

  const rows: ClipMatchRow[] = candidates.map((candidate) => {
    if (!candidate.clipId) return { ...candidate, match: { state: "no_clip_id" } };
    // A file claimed by two records is out of play for both of them.
    const files = (hits.get(candidate.index) ?? []).filter((name) => !ambiguousFileNames.has(name));
    if (files.length === 0) return { ...candidate, match: { state: "no_file" } };
    if (files.length > 1) return { ...candidate, match: { state: "ambiguous_files", fileNames: files } };
    matchedCount += 1;
    usedFiles.add(files[0]!);
    return { ...candidate, match: { state: "matched", fileName: files[0]! } };
  });

  const unusedFiles = fileNames.filter((name) => !usedFiles.has(name) && !ambiguousFileNames.has(name));

  return { rows, unusedFiles, ambiguousFiles, matchedCount };
}
