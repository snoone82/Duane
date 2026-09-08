/** Shared shapes for the PBOS Sales area. Kept out of the card components so
 * the page can build them once and hand the same objects to every card. */

export interface TeamOwner {
  id: string;
  label: string;
}

export interface LeadActionRow {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  ownerLabel: string;
}

export interface TierOption {
  key: string;
  name: string;
  promise: string;
  defaultSetupFee: number | null;
  defaultMonthlyFee: number | null;
}
