/** Pure progress math over a StoryPack + a set of completed step keys. */

import type { Protagonist, StoryMission, StoryPack } from "./gta5";

export type MissionStatus = "done" | "current" | "locked";

export interface MissionProgress {
  mission: StoryMission;
  status: MissionStatus;
  stepsDone: number;
  stepsTotal: number;
  isDone: boolean;
  isUnlocked: boolean;
}

export interface PackProgress {
  missions: MissionProgress[];
  missionsDone: number;
  missionsTotal: number;
  tasksDone: number;
  tasksTotal: number;
}

/** localStorage key for a single completed objective. */
export const stepKey = (missionId: string, index: number) => `${missionId}#${index}`;

export function computeProgress(
  pack: StoryPack,
  completed: Record<string, boolean>
): PackProgress {
  // First pass: which missions are fully done.
  const doneMap: Record<string, boolean> = {};
  for (const m of pack.missions) {
    doneMap[m.id] =
      m.steps.length > 0 && m.steps.every((_, i) => completed[stepKey(m.id, i)]);
  }

  const missions: MissionProgress[] = pack.missions.map((m) => {
    const stepsTotal = m.steps.length;
    const stepsDone = m.steps.reduce(
      (n, _, i) => n + (completed[stepKey(m.id, i)] ? 1 : 0),
      0
    );
    const isUnlocked = m.requires.every((r) => doneMap[r]);
    const isDone = doneMap[m.id];
    const status: MissionStatus = isDone
      ? "done"
      : isUnlocked
        ? "current"
        : "locked";
    return { mission: m, status, stepsDone, stepsTotal, isDone, isUnlocked };
  });

  return {
    missions,
    missionsDone: missions.filter((x) => x.isDone).length,
    missionsTotal: pack.missions.length,
    tasksDone: missions.reduce((n, x) => n + x.stepsDone, 0),
    tasksTotal: pack.missions.reduce((n, m) => n + m.steps.length, 0),
  };
}

/** Every step of every mission, flattened in mission-order then step-order. */
export function orderedStepKeys(pack: StoryPack): string[] {
  const keys: string[] = [];
  for (const m of [...pack.missions].sort((a, b) => a.order - b.order)) {
    for (let i = 0; i < m.steps.length; i++) keys.push(stepKey(m.id, i));
  }
  return keys;
}

/** Fuel one story objective: mark the next open step in order. */
export function advanceOne(
  pack: StoryPack,
  completed: Record<string, boolean>
): { completed: Record<string, boolean>; advancedKey: string | null } {
  const next = orderedStepKeys(pack).find((k) => !completed[k]);
  if (!next) return { completed, advancedKey: null };
  return { completed: { ...completed, [next]: true }, advancedKey: next };
}

/** Undo the most recent advance: unmark the last completed step in order. */
export function retreatOne(
  pack: StoryPack,
  completed: Record<string, boolean>
): Record<string, boolean> {
  let last: string | undefined;
  for (const k of orderedStepKeys(pack)) if (completed[k]) last = k;
  if (!last) return completed;
  const next = { ...completed };
  delete next[last];
  return next;
}

/** Resolve a stepKey (`missionId#index`) back to its mission + label, for feedback. */
export function describeStep(pack: StoryPack, key: string): { title: string; label: string } | null {
  const [missionId, idxRaw] = key.split("#");
  const m = pack.missions.find((x) => x.id === missionId);
  const idx = Number(idxRaw);
  if (!m || !m.steps[idx]) return null;
  return { title: m.title, label: m.steps[idx].label };
}

export const PROTAGONIST_COLORS: Record<Protagonist, string> = {
  michael: "#4a90d9",
  franklin: "#7bc043",
  trevor: "#e8873a",
};

export const PROTAGONIST_NAMES: Record<Protagonist, string> = {
  michael: "Michael",
  franklin: "Franklin",
  trevor: "Trevor",
};
