/**
 * What obviously needs making, worked out from the platform versions that
 * already exist.
 *
 * Duane, after the first real run: "if Instagram is a Reel and LinkedIn is a
 * video, it could suggest Main talking-head video. Then I only need to add
 * the extras." The information is already in Content — one filming job
 * usually serves every video-shaped version of an idea, so PBOS should
 * propose that rather than ask.
 *
 * Pure, so it can be tested and so the same rules drive both the
 * auto-creation on attach and anything that later shows a preview.
 */

import { productionGroupFor, type ProductionGroup } from "@/lib/monthly-plan-format";
import type { ProductionAssetKind } from "@/lib/status";

export interface SuggestionOutput {
  id: string;
  format: string;
}

export interface SuggestedAsset {
  kind: ProductionAssetKind;
  title: string;
  /** The platform versions this one asset would feed. */
  outputIds: string[];
}

/** One asset per production group, because that is how the work actually
 * divides: a shoot, a long-form record, a design session. Within a group the
 * versions differ by crop and length, not by what has to be created. */
const GROUP_ASSET: Record<ProductionGroup, { kind: ProductionAssetKind; title: string }> = {
  filming: { kind: "talking_head", title: "Main talking-head video" },
  long_form: { kind: "video", title: "Long-form recording" },
  assets: { kind: "graphic", title: "Graphics / imagery" },
  writing: { kind: "written", title: "Written copy" },
};

/**
 * The assets an idea obviously needs, given its platform versions.
 *
 * Text-only versions produce nothing — writing a post is the work of writing
 * it, and inventing a production task for it is exactly the busywork Duane is
 * objecting to. An idea whose versions are all text returns an empty list,
 * which is the correct answer rather than a gap.
 */
export function suggestAssets(outputs: SuggestionOutput[]): SuggestedAsset[] {
  const byGroup = new Map<ProductionGroup, string[]>();
  for (const output of outputs) {
    const group = productionGroupFor(output.format);
    // productionGroupFor returns null for plain text — nothing to produce.
    if (!group || group === "writing") continue;
    const list = byGroup.get(group) ?? [];
    list.push(output.id);
    byGroup.set(group, list);
  }

  // Stable order: film first, then long-form, then design — the order a day
  // usually runs in.
  const order: ProductionGroup[] = ["filming", "long_form", "assets"];
  return order
    .filter((group) => byGroup.has(group))
    .map((group) => ({
      kind: GROUP_ASSET[group].kind,
      title: GROUP_ASSET[group].title,
      outputIds: byGroup.get(group) ?? [],
    }));
}
