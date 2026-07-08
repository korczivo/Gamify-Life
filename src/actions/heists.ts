"use server";

import { revalidatePath } from "next/cache";
import {
  archiveHeist,
  finishHeist,
  startHeist,
  startPrepTimer,
  stopPrepTimer,
  type CompletionResult,
} from "@/lib/game";
import type { HeistTier, PrepRequirement } from "@/lib/economy";

function afterMutation() {
  revalidatePath("/", "layout");
}

export async function startHeistAction(input: {
  name: string;
  templateId?: string;
  tier: HeistTier;
  finaleName: string;
  preps: {
    name: string;
    kind: "mandatory" | "optional";
    flavor?: string;
    requirement: PrepRequirement;
    target: number;
  }[];
}): Promise<{
  ok: boolean;
  error?: string;
  heistId?: string;
  loot?: { kind: string; multiplier: number };
}> {
  const r = await startHeist(input);
  if (r.ok) afterMutation();
  return r;
}

export async function finishHeistAction(
  heistId: string
): Promise<CompletionResult & { elite?: boolean }> {
  const r = await finishHeist(heistId);
  if (r.ok) afterMutation();
  return r;
}

export async function startPrepTimerAction(
  heistId: string,
  prepId: string
): Promise<CompletionResult> {
  const r = await startPrepTimer(heistId, prepId);
  if (r.ok) afterMutation();
  return r;
}

export async function stopPrepTimerAction(
  heistId: string,
  prepId: string
): Promise<CompletionResult> {
  const r = await stopPrepTimer(heistId, prepId);
  if (r.ok) afterMutation();
  return r;
}

export async function archiveHeistAction(heistId: string): Promise<void> {
  await archiveHeist(heistId);
  afterMutation();
}
