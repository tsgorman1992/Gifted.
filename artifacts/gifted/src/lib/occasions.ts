// Floating occasion keys and date computation helpers.
// Used by my-gifts.tsx, preview.tsx, and any other page that needs occasion logic.

export const FLOATING_OCCASION_KEYS: Record<string, string> = {
  "Mother's Day":  "mothers-day",
  "Father's Day":  "fathers-day",
  "Thanksgiving":  "thanksgiving",
};

export function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const d = new Date(year, month - 1, 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + (n - 1) * 7);
  return d.getDate();
}

export function computeFloatingDate(floatingKey: string, year: number): { month: number; day: number } {
  switch (floatingKey) {
    case "mothers-day":  return { month: 5,  day: nthWeekdayOfMonth(year, 5,  0, 2) };
    case "fathers-day":  return { month: 6,  day: nthWeekdayOfMonth(year, 6,  0, 3) };
    case "thanksgiving": return { month: 11, day: nthWeekdayOfMonth(year, 11, 4, 4) };
    default:             return { month: 1,  day: 1 };
  }
}

export type OccasionLike = { month: number | null; day: number | null; floatingKey: string | null };

export function resolveOccasionDate(occ: OccasionLike): { month: number; day: number } {
  if (occ.floatingKey) {
    return computeFloatingDate(occ.floatingKey, new Date().getFullYear());
  }
  return { month: occ.month!, day: occ.day! };
}

export function daysUntilOccasion(occ: OccasionLike): number {
  const today = new Date();
  const year  = today.getFullYear();
  const resolved = occ.floatingKey
    ? computeFloatingDate(occ.floatingKey, year)
    : { month: occ.month!, day: occ.day! };
  let target = new Date(year, resolved.month - 1, resolved.day);
  if (target < today) {
    const nextResolved = occ.floatingKey ? computeFloatingDate(occ.floatingKey, year + 1) : resolved;
    target = new Date(year + 1, nextResolved.month - 1, nextResolved.day);
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function buildOccasionPayload(
  label: string,
  month: number,
  day: number
): { label: string; floatingKey: string } | { label: string; month: number; day: number } {
  const floatingKey = FLOATING_OCCASION_KEYS[label];
  return floatingKey ? { label, floatingKey } : { label, month, day };
}
