import type { FileCategory } from "@/lib/enums";

/** Brief §18's asset library categories, plus `contract` (a real agency
 * need the brief doesn't mention) and `other` as a catch-all. */
export const FILE_CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: "brand_photography", label: "Brand photography" },
  { value: "video", label: "Video" },
  { value: "podcast_footage", label: "Podcast footage" },
  { value: "logo", label: "Logo" },
  { value: "brand_guideline", label: "Brand guideline" },
  { value: "strategy_document", label: "Strategy document" },
  { value: "script", label: "Script" },
  { value: "content_calendar", label: "Content calendar" },
  { value: "presentation", label: "Presentation" },
  { value: "press_kit", label: "Press kit" },
  { value: "bio", label: "Bio" },
  { value: "headshot", label: "Headshot" },
  { value: "testimonial", label: "Testimonial" },
  { value: "case_study", label: "Case study" },
  { value: "contract", label: "Contract" },
  { value: "other", label: "Other" },
];

export function fileCategoryLabel(value: FileCategory): string {
  return FILE_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}
