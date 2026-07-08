"use server";

import { revalidatePath } from "next/cache";
import {
  buyAsset,
  buySupplies,
  buyUpgrade,
  collectSafe,
  sellStock,
  setDailyDriver,
  setPinnedGoal,
  type CompletionResult,
} from "@/lib/game";

function afterMutation() {
  revalidatePath("/", "layout");
}

export async function collectSafeAction(): Promise<CompletionResult> {
  const r = await collectSafe();
  if (r.ok) afterMutation();
  return r;
}

export async function buyAssetAction(assetId: string): Promise<CompletionResult> {
  const r = await buyAsset(assetId);
  if (r.ok) afterMutation();
  return r;
}

export async function buyUpgradeAction(
  assetId: string,
  upgradeId: string
): Promise<CompletionResult> {
  const r = await buyUpgrade(assetId, upgradeId);
  if (r.ok) afterMutation();
  return r;
}

export async function buySuppliesAction(assetId: string): Promise<CompletionResult> {
  const r = await buySupplies(assetId);
  if (r.ok) afterMutation();
  return r;
}

export async function sellStockAction(assetId: string): Promise<CompletionResult> {
  const r = await sellStock(assetId);
  if (r.ok) afterMutation();
  return r;
}

export async function setDailyDriverAction(assetId: string): Promise<void> {
  await setDailyDriver(assetId);
  afterMutation();
}

export async function setPinnedGoalAction(assetId: string | null): Promise<void> {
  await setPinnedGoal(assetId);
  afterMutation();
}
