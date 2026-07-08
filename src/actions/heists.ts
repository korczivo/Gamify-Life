"use server";

import { revalidatePath } from "next/cache";
import {
  archiveHeist,
  finishHeist,
  scopeHeist,
  startHeist,
  type CompletionResult,
} from "@/lib/game";
import type { HeistTier } from "@/lib/economy";

function afterMutation() {
  revalidatePath("/", "layout");
}

export async function startHeistAction(input: {
  name: string;
  tier: HeistTier;
  finaleName: string;
  preps: { name: string; kind: "mandatory" | "optional" }[];
}): Promise<{ ok: boolean; error?: string; heistId?: string }> {
  const r = await startHeist(input);
  if (r.ok) afterMutation();
  return r;
}

export async function scopeHeistAction(
  heistId: string
): Promise<{ ok: boolean; error?: string; loot?: { kind: string; multiplier: number } }> {
  const r = await scopeHeist(heistId);
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

export async function archiveHeistAction(heistId: string): Promise<void> {
  await archiveHeist(heistId);
  afterMutation();
}
