/**
 * Seeds the player singleton and starter mission templates.
 * Idempotent: skips templates that already exist by name.
 *
 * Run: npx tsx scripts/seed.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { dbConnect } = await import("../src/lib/db");
  const { getPlayer } = await import("../src/lib/game");
  const { MissionTemplate } = await import("../src/lib/models/MissionTemplate");
  const { DIFFICULTY } = await import("../src/lib/economy");

  await dbConnect();
  await getPlayer();
  console.log("Player singleton ready");

  const templates = [
    {
      name: "Send 10 cold DMs",
      businessType: "marketing",
      objectiveType: "counter",
      targetCount: 10,
      difficulty: "medium",
      schedule: { kind: "daily", timesPerPeriod: 1 },
      sortOrder: 1,
    },
    {
      name: "Publish 1 Reddit post",
      businessType: "marketing",
      objectiveType: "checkbox",
      difficulty: "easy",
      schedule: { kind: "daily", timesPerPeriod: 1 },
      sortOrder: 2,
    },
    {
      name: "Deep Work: Marketing (45 min)",
      businessType: "marketing",
      objectiveType: "timer",
      durationMinutes: 45,
      difficulty: "medium",
      schedule: { kind: "daily", timesPerPeriod: 2 },
      sortOrder: 3,
    },
    {
      name: "Deep Work: Programming (45 min)",
      businessType: "dev",
      objectiveType: "timer",
      durationMinutes: 45,
      difficulty: "medium",
      schedule: { kind: "daily", timesPerPeriod: 2 },
      sortOrder: 4,
    },
    {
      name: "Write SEO post",
      businessType: "content",
      objectiveType: "checkbox",
      difficulty: "hard",
      schedule: { kind: "weekly", timesPerPeriod: 3 },
      sortOrder: 5,
    },
  ] as const;

  for (const t of templates) {
    const existing = await MissionTemplate.findOne({ name: t.name });
    if (existing) {
      console.log(`skip  ${t.name}`);
      continue;
    }
    const d = DIFFICULTY[t.difficulty];
    await MissionTemplate.create({
      ...t,
      cashReward: d.cash,
      rpReward: d.rp,
      active: true,
    });
    console.log(`seed  ${t.name}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
