import { dbConnect } from "@/lib/db";
import { ActivityDay } from "@/lib/models/ActivityDay";
import { dayKey } from "@/lib/dates";

const WEEKS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

function intensity(rp: number): string {
  if (rp <= 0) return "bg-panel-2";
  if (rp < 200) return "bg-cash/25";
  if (rp < 500) return "bg-cash/45";
  if (rp < 900) return "bg-cash/70";
  return "bg-cash";
}

/** GitHub-style activity heatmap over the last ~20 weeks. */
export async function ActivityHeatmap() {
  await dbConnect();
  const days = await ActivityDay.find({}).lean();
  const byKey = new Map(days.map((d) => [d.dayKey, d]));

  const today = new Date();
  // Align the grid to Monday columns.
  const dow = (today.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(today.getTime() - (WEEKS * 7 - 1 + dow) * DAY_MS);

  const columns: { key: string; rp: number; label: string }[][] = [];
  for (let w = 0; w < WEEKS + 1; w++) {
    const col: { key: string; rp: number; label: string }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getTime() + (w * 7 + d) * DAY_MS);
      if (date.getTime() > today.getTime()) break;
      const key = dayKey(date);
      const day = byKey.get(key);
      col.push({
        key,
        rp: day?.rpEarned ?? 0,
        label: `${key} · ${day?.missionsCompleted ?? 0} missions · $${(
          day?.cashEarned ?? 0
        ).toLocaleString("en-US")} · ${day?.rpEarned ?? 0} RP`,
      });
    }
    if (col.length > 0) columns.push(col);
  }

  return (
    <div className="flex gap-1 overflow-x-auto">
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-1">
          {col.map((cell) => (
            <div
              key={cell.key}
              title={cell.label}
              className={`h-3.5 w-3.5 rounded-[3px] ${intensity(cell.rp)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
