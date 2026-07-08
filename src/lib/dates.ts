/**
 * All period-key math lives here. A "day" starts at DAY_START_HOUR local time,
 * so a 1 AM deep-work session still counts toward the previous day's grind.
 * Nothing outside this file may compute a dayKey/weekKey.
 */
export const DAY_START_HOUR = 4;

function shifted(date: Date): Date {
  return new Date(date.getTime() - DAY_START_HOUR * 60 * 60 * 1000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-07-08" — local date with the 4 AM boundary applied. */
export function dayKey(date: Date = new Date()): string {
  const d = shifted(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-W28" — ISO week (Monday start) with the 4 AM boundary applied. */
export function weekKey(date: Date = new Date()): string {
  const d = shifted(date);
  // ISO week: Thursday of the current week determines the year/week number.
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (thursday.getDay() + 6) % 7; // 0 = Monday
  thursday.setDate(thursday.getDate() - dow + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const firstDow = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDow + 3);
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${thursday.getFullYear()}-W${pad(week)}`;
}

/** Hours elapsed between two dates. */
export function hoursBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (60 * 60 * 1000);
}
