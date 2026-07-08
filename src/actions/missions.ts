"use server";

import { revalidatePath } from "next/cache";
import {
  addOneOffMission,
  completeMission,
  incrementProgress,
  type CompletionResult,
} from "@/lib/game";
import { dbConnect } from "@/lib/db";
import { MissionTemplate } from "@/lib/models/MissionTemplate";
import { Mission } from "@/lib/models/Mission";
import { DIFFICULTY, type BusinessType, type Difficulty, type ObjectiveType } from "@/lib/economy";

/** The HUD lives in the root layout, so every mutation revalidates the layout. */
function afterMutation() {
  revalidatePath("/", "layout");
}

export async function completeMissionAction(missionId: string): Promise<CompletionResult> {
  const result = await completeMission(missionId);
  if (result.ok) afterMutation();
  return result;
}

export async function incrementProgressAction(missionId: string): Promise<CompletionResult> {
  const result = await incrementProgress(missionId);
  if (result.ok) afterMutation();
  return result;
}

export interface OneOffInput {
  name: string;
  businessType: BusinessType;
  objectiveType: ObjectiveType;
  difficulty: Difficulty;
  targetCount?: number;
  durationMinutes?: number;
}

export async function addOneOffAction(input: OneOffInput): Promise<void> {
  await addOneOffMission(input);
  afterMutation();
}

export interface TemplateInput extends OneOffInput {
  scheduleKind: "daily" | "weekly";
  timesPerPeriod: number;
}

export async function createTemplateAction(input: TemplateInput): Promise<void> {
  await dbConnect();
  const d = DIFFICULTY[input.difficulty];
  const count = await MissionTemplate.countDocuments();
  await MissionTemplate.create({
    name: input.name,
    businessType: input.businessType,
    objectiveType: input.objectiveType,
    targetCount: input.objectiveType === "counter" ? input.targetCount ?? 10 : undefined,
    durationMinutes: input.objectiveType === "timer" ? input.durationMinutes ?? 45 : undefined,
    difficulty: input.difficulty,
    cashReward: d.cash,
    rpReward: d.rp,
    schedule: { kind: input.scheduleKind, timesPerPeriod: input.timesPerPeriod },
    active: true,
    sortOrder: count + 1,
  });
  afterMutation();
}

export async function setTemplateActiveAction(id: string, active: boolean): Promise<void> {
  await dbConnect();
  await MissionTemplate.updateOne({ _id: id }, { $set: { active } });
  // Deactivating also clears today's open instances of that template.
  if (!active) await Mission.deleteMany({ templateId: id, status: "open" });
  afterMutation();
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await dbConnect();
  await MissionTemplate.deleteOne({ _id: id });
  await Mission.deleteMany({ templateId: id, status: "open" });
  afterMutation();
}

export async function deleteOneOffAction(missionId: string): Promise<void> {
  await dbConnect();
  await Mission.deleteOne({ _id: missionId, isOneOff: true, status: "open", heistId: null });
  afterMutation();
}
