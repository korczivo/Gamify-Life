"use server";

import { revalidatePath } from "next/cache";
import { dbConnect } from "@/lib/db";
import { getPlayer, type CompletionResult } from "@/lib/game";
import { LedgerEntry } from "@/lib/models/LedgerEntry";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { assetById, PLASTIC_SURGERY_COST, PORTRAIT_IDS } from "@/lib/economy";
import { dayKey } from "@/lib/dates";

async function currentNetWorth(cash: number, safe: number): Promise<number> {
  const owned = await OwnedAsset.find({}).lean();
  let assets = 0;
  for (const o of owned) {
    assets += o.purchasePrice;
    const def = assetById(o.assetId);
    for (const upId of o.upgrades ?? []) {
      const up = def.upgrades?.find((u) => u.id === upId);
      if (up) assets += up.price;
    }
  }
  return cash + safe + assets;
}

/** First-time character creation — free, one shot. */
export async function createCharacterAction(
  name: string,
  portraitId: string
): Promise<CompletionResult> {
  await dbConnect();
  if (!name.trim() || !PORTRAIT_IDS.includes(portraitId)) {
    return { ok: false, error: "Pick a face and a name" };
  }
  const player = await getPlayer();
  if (player.characterName) return { ok: false, error: "Character already created" };
  player.characterName = name.trim().slice(0, 24);
  player.portraitId = portraitId;
  await player.save();
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change looks/name later — costs real money, like GTA's appearance change. */
export async function plasticSurgeryAction(
  name: string,
  portraitId: string
): Promise<CompletionResult> {
  await dbConnect();
  if (!name.trim() || !PORTRAIT_IDS.includes(portraitId)) {
    return { ok: false, error: "Pick a face and a name" };
  }
  const player = await getPlayer();
  if (player.cash < PLASTIC_SURGERY_COST) {
    return {
      ok: false,
      error: `Not enough cash — surgery costs $${PLASTIC_SURGERY_COST.toLocaleString("en-US")}`,
    };
  }
  player.cash -= PLASTIC_SURGERY_COST;
  player.characterName = name.trim().slice(0, 24);
  player.portraitId = portraitId;
  await player.save();
  await LedgerEntry.create({
    type: "UPGRADE_PURCHASE",
    amountCash: -PLASTIC_SURGERY_COST,
    amountRp: 0,
    note: "Plastic surgery — new look",
    balanceAfter: player.cash,
    netWorthAfter: await currentNetWorth(player.cash, player.safeBalance),
    dayKey: dayKey(),
  });
  revalidatePath("/", "layout");
  return { ok: true, cashDelta: -PLASTIC_SURGERY_COST };
}
