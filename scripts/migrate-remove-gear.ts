import { config } from "dotenv";
config({ path: ".env.local" });

const OLD_GEAR = ["mech-keyboard","espresso-machine","sm7b","aeron-chair","standing-desk","macbook-pro","a7s-camera","mac-studio"];

async function main() {
  const { dbConnect } = await import("../src/lib/db");
  const { OwnedAsset } = await import("../src/lib/models/OwnedAsset");
  const { Player } = await import("../src/lib/models/Player");
  const { LedgerEntry } = await import("../src/lib/models/LedgerEntry");
  const { assetById } = await import("../src/lib/economy");
  const { dayKey } = await import("../src/lib/dates");

  await dbConnect();
  const oldOwned = await OwnedAsset.find({ assetId: { $in: OLD_GEAR } });
  if (oldOwned.length === 0) { console.log("no legacy gear owned — nothing to do"); process.exit(0); }

  const refund = oldOwned.reduce((s, o) => s + o.purchasePrice, 0);
  await OwnedAsset.deleteMany({ assetId: { $in: OLD_GEAR } });
  const player = (await Player.findById("player"))!;
  player.cash += refund;
  await player.save();

  // net worth after: cash + safe + remaining assets
  const remaining = await OwnedAsset.find({}).lean();
  let assets = 0;
  for (const o of remaining) {
    assets += o.purchasePrice;
    const def = assetById(o.assetId);
    for (const up of o.upgrades ?? []) { const u = def.upgrades?.find(x => x.id === up); if (u) assets += u.price; }
  }
  await LedgerEntry.create({
    type: "REFUND", amountCash: refund, amountRp: 0,
    note: `Founder gear discontinued — full refund (${oldOwned.length} items)`,
    balanceAfter: player.cash, netWorthAfter: player.cash + player.safeBalance + assets,
    dayKey: dayKey(),
  });
  console.log(`refunded $${refund.toLocaleString()} for ${oldOwned.length} legacy gear items`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
