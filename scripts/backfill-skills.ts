import { config } from "dotenv";
config({ path: ".env.local" });
async function main() {
  const { dbConnect } = await import("../src/lib/db");
  const { Player } = await import("../src/lib/models/Player");
  const { Mission } = await import("../src/lib/models/Mission");
  const { Heist } = await import("../src/lib/models/Heist");
  await dbConnect();

  const missions = await Mission.find({ status: "completed" }).lean();
  const skills: Record<string, number> = { marketing: 0, dev: 0, content: 0, admin: 0, focus: 0, reputation: 0 };
  for (const m of missions) {
    skills[m.businessType] = (skills[m.businessType] ?? 0) + (m.tickWeight ?? 0);
    if (m.objectiveType === "timer") skills.focus += (m.durationMinutes ?? 0) / 45;
  }
  const heists = await Heist.find({ status: "completed" }).lean();
  const repGain: Record<string, number> = { small: 1, medium: 2, big: 3, cayo: 4 };
  for (const h of heists) skills.reputation += repGain[h.tier] ?? 1;

  const p = (await Player.findById("player"))!;
  p.skills = skills as never;
  p.markModified("skills");
  await p.save();
  console.log("backfilled skills:", JSON.stringify(skills));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
