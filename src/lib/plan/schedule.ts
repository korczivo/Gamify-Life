/**
 * Weekly planner model — each week is its own concrete plan: 7 buckets (Mon–Sun)
 * of task cards, no clock times. Every task belongs to ONE week (its own id), so
 * editing or deleting it never touches another week. Repeat a week with "copy
 * last week". A task belongs to a track (marketing / content / dev) or "life".
 *
 * Day 0 = Monday … 6 = Sunday.
 */

export type PlanCategory = "marketing" | "content" | "dev" | "life";

export interface PlanBlock {
  id: string;
  day: number; // 0 = Mon … 6 = Sun
  title: string;
  category: PlanCategory;
  /** Optional link to a cross-week Goal — completing this task bumps that goal. */
  goalId?: string;
}

export const CATEGORY_META: Record<
  PlanCategory,
  { label: string; color: string; track: boolean }
> = {
  marketing: { label: "Marketing", color: "#4a90d9", track: true },
  content: { label: "Content", color: "#17a39c", track: true },
  dev: { label: "Dev", color: "#e0632a", track: true },
  life: { label: "Life", color: "#5b6470", track: false },
};

export const TRACKED: PlanCategory[] = ["marketing", "content", "dev"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Default weekly targets: number of tasks per tracked track. */
export const DEFAULT_TARGETS: Record<PlanCategory, number> = {
  marketing: 5,
  content: 4,
  dev: 4,
  life: 0,
};

export interface TrackContract {
  category: PlanCategory;
  planned: number;
  done: number;
  target: number;
}

export function computeContract(
  blocks: PlanBlock[],
  done: Record<string, boolean>,
  targets: Record<PlanCategory, number>
): TrackContract[] {
  return TRACKED.map((cat) => {
    const inCat = blocks.filter((b) => b.category === cat);
    return {
      category: cat,
      planned: inCat.length,
      done: inCat.filter((b) => done[b.id]).length,
      target: targets[cat] ?? 0,
    };
  });
}
