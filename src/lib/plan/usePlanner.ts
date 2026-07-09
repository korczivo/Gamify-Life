"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_TARGETS, type PlanBlock, type PlanCategory } from "./schedule";

export interface Goal {
  id: string;
  label: string;
  emoji: string;
  target: number;
  /** Manual baseline; total shown = manual + completions of linked tasks. */
  manual: number;
}

interface WeekState {
  items: PlanBlock[];
  done: Record<string, boolean>;
}

const EMPTY_WEEK: WeekState = { items: [], done: {} };

const DEFAULT_GOALS: Goal[] = [
  { id: "g-yt", label: "YouTube videos", emoji: "🎬", target: 30, manual: 0 },
  { id: "g-blog", label: "Blog posts", emoji: "✍️", target: 20, manual: 0 },
  { id: "g-dm", label: "Cold DMs", emoji: "📣", target: 100, manual: 0 },
];

const newId = () => "b-" + Math.random().toString(36).slice(2, 9);

/* ---------- persistence + date helpers ---------- */

function usePersisted<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setVal(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }, [key, val, hydrated]);
  return [val, setVal, hydrated] as const;
}

/** Monday (local midnight) of the week `offset` weeks from the current real week. */
export function mondayOf(offset: number): Date {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Mon
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7);
}

/** Stable ISO-week key, e.g. "2026-W28". */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function fmtRange(monday: Date): string {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  const mo = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const so = sun.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${mo} – ${so}`;
}

/* ---------- the planner ---------- */

export function usePlanner() {
  const [weeks, setWeeks, hydrated] = usePersisted<Record<string, WeekState>>(
    "plan-weeks-v3",
    {}
  );
  const [goals, setGoals] = usePersisted<Goal[]>("plan-goals-v3", DEFAULT_GOALS);
  const [targets, setTargets] = usePersisted<Record<PlanCategory, number>>(
    "plan-targets-v3",
    DEFAULT_TARGETS
  );
  const [offset, setOffset] = usePersisted<number>("plan-offset-v3", 0);

  const monday = useMemo(() => mondayOf(offset), [offset]);
  const weekKey = useMemo(() => isoWeekKey(monday), [monday]);
  const week = weeks[weekKey] ?? EMPTY_WEEK;
  const visibleBlocks = week.items;

  // Goal totals derived from every stored week's completed, goal-linked tasks — no drift.
  const goalCurrent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of Object.values(weeks)) {
      for (const b of w.items) {
        if (w.done[b.id] && b.goalId) counts[b.goalId] = (counts[b.goalId] ?? 0) + 1;
      }
    }
    const out: Record<string, number> = {};
    for (const g of goals) out[g.id] = g.manual + (counts[g.id] ?? 0);
    return out;
  }, [weeks, goals]);

  const updateWeek = useCallback(
    (fn: (w: WeekState) => WeekState) =>
      setWeeks((prev) => ({ ...prev, [weekKey]: fn(prev[weekKey] ?? EMPTY_WEEK) })),
    [setWeeks, weekKey]
  );

  const toggleDone = useCallback(
    (id: string) =>
      updateWeek((w) => {
        const done = { ...w.done };
        if (done[id]) delete done[id];
        else done[id] = true;
        return { ...w, done };
      }),
    [updateWeek]
  );

  const addBlock = useCallback(
    (block: PlanBlock) => updateWeek((w) => ({ ...w, items: [...w.items, block] })),
    [updateWeek]
  );

  const updateBlock = useCallback(
    (block: PlanBlock) =>
      updateWeek((w) => ({
        ...w,
        items: w.items.map((b) => (b.id === block.id ? block : b)),
      })),
    [updateWeek]
  );

  const removeBlock = useCallback(
    (id: string) =>
      updateWeek((w) => {
        const done = { ...w.done };
        delete done[id];
        return { items: w.items.filter((b) => b.id !== id), done };
      }),
    [updateWeek]
  );

  const clearWeek = useCallback(() => updateWeek(() => ({ items: [], done: {} })), [updateWeek]);

  const copyLastWeek = useCallback(() => {
    const prevKey = isoWeekKey(mondayOf(offset - 1));
    const prev = weeks[prevKey]?.items ?? [];
    if (!prev.length) return;
    const clones = prev.map((b) => ({ ...b, id: newId() }));
    updateWeek((w) => ({ ...w, items: [...w.items, ...clones] }));
  }, [offset, weeks, updateWeek]);

  const setTarget = useCallback(
    (cat: PlanCategory, n: number) => setTargets((t) => ({ ...t, [cat]: Math.max(0, n) })),
    [setTargets]
  );

  const addGoal = useCallback(
    (label: string, target: number, emoji: string) =>
      setGoals((g) => [
        ...g,
        { id: "g-" + Math.random().toString(36).slice(2, 9), label, emoji: emoji || "🎯", target, manual: 0 },
      ]),
    [setGoals]
  );
  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) =>
      setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [setGoals]
  );
  const bumpGoal = useCallback(
    (id: string, delta: number) =>
      setGoals((g) => g.map((x) => (x.id === id ? { ...x, manual: x.manual + delta } : x))),
    [setGoals]
  );
  const removeGoal = useCallback(
    (id: string) => setGoals((g) => g.filter((x) => x.id !== id)),
    [setGoals]
  );

  return {
    hydrated,
    offset,
    setOffset,
    monday,
    isThisWeek: offset === 0,
    week,
    visibleBlocks,
    goals,
    goalCurrent,
    targets,
    hasPrevWeek: (weeks[isoWeekKey(mondayOf(offset - 1))]?.items.length ?? 0) > 0,
    // actions
    toggleDone,
    addBlock,
    updateBlock,
    removeBlock,
    clearWeek,
    copyLastWeek,
    setTarget,
    addGoal,
    updateGoal,
    bumpGoal,
    removeGoal,
  };
}
