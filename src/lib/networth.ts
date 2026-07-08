import { dbConnect } from "./db";
import { LedgerEntry } from "./models/LedgerEntry";
import { dayKey } from "./dates";

export interface NetWorthPoint {
  label: string; // "08.07" for daily points, "13:05" for intraday
  value: number;
}

export interface NetWorthSeries {
  points: NetWorthPoint[];
  caption: string; // "since 01.07 · 8 days" | "today, per transaction"
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtDay(day: string): string {
  const [, m, d] = day.split("-");
  return `${d}.${m}`;
}

/**
 * Net-worth series for charts. With 2+ days of history: one point per calendar
 * day (last ledger value, gaps filled) so time is evenly spaced. With a young
 * game (single day): per-transaction intraday points, so the curve moves from
 * mission one.
 */
export async function buildNetWorthSeries(maxDays = 90): Promise<NetWorthSeries> {
  await dbConnect();
  const entries = await LedgerEntry.find({})
    .sort({ createdAt: 1 })
    .select({ netWorthAfter: 1, dayKey: 1, createdAt: 1 })
    .lean();
  if (entries.length === 0) return { points: [], caption: "" };

  const uniqueDays = new Set(entries.map((e) => e.dayKey));

  if (uniqueDays.size < 2) {
    const points = entries.map((e) => {
      const d = new Date(e.createdAt as unknown as string);
      return {
        label: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        value: e.netWorthAfter,
      };
    });
    return { points, caption: "today, per transaction" };
  }

  const lastPerDay = new Map<string, number>();
  for (const e of entries) lastPerDay.set(e.dayKey, e.netWorthAfter);

  const firstDay = entries[0].dayKey;
  const today = dayKey();
  const points: NetWorthPoint[] = [];
  let value = 0;
  // Find the timestamp of the first day, then walk forward day by day
  // (dayKey applies the 4 AM boundary).
  let start = Date.now();
  while (dayKey(new Date(start)) !== firstDay && Date.now() - start < 400 * DAY_MS) {
    start -= DAY_MS;
  }
  for (let t = start; points.length < 400; t += DAY_MS) {
    const key = dayKey(new Date(t));
    value = lastPerDay.get(key) ?? value;
    points.push({ label: fmtDay(key), value });
    if (key === today) break;
  }
  const sliced = points.slice(-maxDays);
  return {
    points: sliced,
    caption: `since ${sliced[0]?.label ?? ""} · ${sliced.length} days`,
  };
}
