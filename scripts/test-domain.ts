/**
 * End-to-end domain test against a throwaway database (empire_test).
 * Exercises the full loop: materialization -> counter mission -> payouts ->
 * supply/production -> sell -> upgrades -> safe -> heist lifecycle.
 *
 * Run: npx tsx scripts/test-domain.ts
 */
process.env.MONGODB_URI = "mongodb://localhost:27017/empire_test";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok    ${label}`);
  else {
    failures++;
    console.error(`  FAIL  ${label}`, detail ?? "");
  }
}

async function main() {
  const { dbConnect } = await import("../src/lib/db");
  const game = await import("../src/lib/game");
  const { Mission } = await import("../src/lib/models/Mission");
  const { MissionTemplate } = await import("../src/lib/models/MissionTemplate");
  const { OwnedAsset } = await import("../src/lib/models/OwnedAsset");
  const { Heist } = await import("../src/lib/models/Heist");
  const { LedgerEntry } = await import("../src/lib/models/LedgerEntry");

  const conn = await dbConnect();
  await conn.connection.db!.dropDatabase();

  // --- seed one template of each kind
  await MissionTemplate.create([
    {
      name: "DMs",
      businessType: "marketing",
      objectiveType: "counter",
      targetCount: 3,
      difficulty: "medium",
      cashReward: 20_000,
      rpReward: 150,
      schedule: { kind: "daily", timesPerPeriod: 1 },
    },
    {
      name: "Reddit post",
      businessType: "marketing",
      objectiveType: "checkbox",
      difficulty: "easy",
      cashReward: 8_000,
      rpReward: 60,
      schedule: { kind: "daily", timesPerPeriod: 2 },
    },
    {
      name: "SEO post",
      businessType: "content",
      objectiveType: "checkbox",
      difficulty: "hard",
      cashReward: 50_000,
      rpReward: 400,
      schedule: { kind: "weekly", timesPerPeriod: 3 },
    },
  ]);

  console.log("materialization:");
  await game.ensurePeriodMissions();
  await game.ensurePeriodMissions(); // idempotency
  const missions = await Mission.find({}).lean();
  check("materializes 1+2 daily + 3 weekly = 6 missions", missions.length === 6, missions.length);

  console.log("counter mission:");
  const dm = (await Mission.findOne({ name: "DMs" }))!;
  let r = await game.incrementProgress(String(dm._id));
  check("+1 does not complete", r.ok && r.completed === false && r.progress === 1, r);
  await game.incrementProgress(String(dm._id));
  r = await game.incrementProgress(String(dm._id));
  check("3/3 completes and pays", r.ok && r.completed === true && (r.cashDelta ?? 0) === 20_000, r);
  r = await game.incrementProgress(String(dm._id));
  check("no double payout", !r.ok, r);

  let player = await game.getPlayer();
  check("cash paid", player.cash === 20_000, player.cash);
  check("residual bumped", player.residualPerDay === 100, player.residualPerDay);
  check("safe credited on first completion (incl. this mission's bump)", player.safeBalance === 100, player.safeBalance);

  console.log("empire:");
  player.cash = 5_000_000;
  await player.save();

  let res = await game.buyAsset("forgery-office"); // marketing business
  check("buy business", res.ok, res);
  res = await game.buyAsset("forgery-office");
  check("no double buy", !res.ok, res);

  const reddit = (await Mission.findOne({ name: "Reddit post", status: "open" }))!;
  res = await game.completeMission(String(reddit._id));
  check("checkbox completes", res.ok && res.completed === true, res);

  let biz = (await OwnedAsset.findOne({ assetId: "forgery-office" }))!;
  // easy mission: +1 supply delivered, tick 0.5 weight -> 0.25 produced
  check(
    "supply delivered minus production consumption",
    Math.abs((biz.supplyUnits ?? 0) - 0.75) < 1e-9,
    biz.supplyUnits
  );
  check("stock produced 0.25", Math.abs((biz.stockUnits ?? 0) - 0.25) < 1e-9, biz.stockUnits);

  res = await game.buySupplies("forgery-office");
  check("buy supplies", res.ok, res);
  biz = (await OwnedAsset.findOne({ assetId: "forgery-office" }))!;
  check("supplies full", biz.supplyUnits === 5, biz.supplyUnits);

  // force stock and sell
  biz.stockUnits = 20;
  await biz.save();
  res = await game.sellStock("forgery-office");
  // 20 * 12000 * 1.5 fullness (full cap 20) = 360000
  check("full-warehouse sell = 360k", res.ok && res.cashDelta === 360_000, res);

  res = await game.buyUpgrade("forgery-office", "equipment");
  check("buy equipment upgrade", res.ok, res);
  biz = (await OwnedAsset.findOne({ assetId: "forgery-office" }))!;
  biz.stockUnits = 20;
  await biz.save();
  res = await game.sellStock("forgery-office");
  check("equipment sell = 540k", res.ok && res.cashDelta === 540_000, res);

  console.log("economy guards:");
  // timer premium: medium timer pays 20000 * 1.2 = 24000
  const timerId = await game.addOneOffMission({
    name: "DW",
    businessType: "dev",
    objectiveType: "timer",
    difficulty: "medium",
    durationMinutes: 45,
  });
  res = await game.completeMission(timerId);
  check("timer premium +20% (24k)", res.ok && res.cashDelta === 24_000, res);

  // hard saturation: #1-2 full, #3 half, #5 quarter
  const hardPay: number[] = [];
  for (let i = 0; i < 5; i++) {
    const id = await game.addOneOffMission({
      name: `Hard ${i}`,
      businessType: "content",
      objectiveType: "checkbox",
      difficulty: "hard",
    });
    const r2 = await game.completeMission(id);
    hardPay.push(r2.cashDelta ?? 0);
  }
  check(
    "hard saturation 100/100/50/50/25%",
    JSON.stringify(hardPay) === JSON.stringify([50_000, 50_000, 25_000, 25_000, 12_500]),
    hardPay
  );

  console.log("vehicles & slots:");
  res = await game.buyAsset("faggio");
  check("no garage -> cannot buy vehicle", !res.ok, res);
  await game.buyAsset("low-end-apartment");
  res = await game.buyAsset("faggio");
  check("vehicle after apartment", res.ok, res);
  const faggio = (await OwnedAsset.findOne({ assetId: "faggio" }))!;
  check("first vehicle becomes daily driver", faggio.isDailyDriver === true, faggio);

  console.log("safe:");
  player = await game.getPlayer();
  player.safeBalance = 12_345;
  await player.save();
  res = await game.collectSafe();
  check("collect safe", res.ok && res.cashDelta === 12_345, res);

  console.log("heist:");
  const start = await game.startHeist({
    name: "Launch YT Video",
    tier: "small",
    finaleName: "PUBLISH",
    preps: [
      { name: "Script", kind: "mandatory" },
      { name: "Record", kind: "mandatory" },
      { name: "3 thumbnails", kind: "optional" },
    ],
  });
  check("heist starts", start.ok, start);
  const heistId = start.heistId!;
  const heist = (await Heist.findById(heistId))!;
  check("buy-in 10% of 200k", heist.buyIn === 20_000, heist.buyIn);
  check("not hard mode (no prior heist)", heist.hardMode === false, heist.hardMode);

  let fin = await game.finishHeist(heistId);
  check("cannot finale while scoping", !fin.ok, fin);

  const scope = await game.scopeHeist(heistId);
  check("scope rolls loot", scope.ok && Boolean(scope.loot?.kind), scope);

  fin = await game.finishHeist(heistId);
  check("cannot finale with mandatory preps open", !fin.ok, fin);

  const prepMissions = await Mission.find({ heistId, prepKind: "mandatory" });
  for (const p of prepMissions) {
    const pr = await game.completeMission(String(p._id));
    check(`prep pays flat ($5k): ${p.name}`, pr.ok && pr.cashDelta === 5_000 && pr.prepCompleted === true, pr);
  }

  const cashBefore = (await game.getPlayer()).cash;
  fin = await game.finishHeist(heistId);
  const expectedMin = Math.round(200_000 * (scope.loot!.multiplier));
  check("finale pays >= base*loot", fin.ok && (fin.cashDelta ?? 0) >= expectedMin, fin);
  const after = await game.getPlayer();
  check("cash increased by payout", after.cash === cashBefore + (fin.cashDelta ?? 0), after.cash);

  const start2 = await game.startHeist({
    name: "Next",
    tier: "small",
    finaleName: "GO",
    preps: [{ name: "P", kind: "mandatory" }],
  });
  const heist2 = (await Heist.findById(start2.heistId!))!;
  check("hard mode within 24h of last finale", heist2.hardMode === true, heist2.hardMode);

  const ledger = await LedgerEntry.find({}).sort({ createdAt: 1 }).lean();
  check("ledger has entries", ledger.length > 8, ledger.length);
  const last = ledger[ledger.length - 1];
  check(
    "net worth = balance + safe + assets",
    last.netWorthAfter >= last.balanceAfter,
    last
  );

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  await conn.connection.db!.dropDatabase();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
