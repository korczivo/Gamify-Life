/**
 * Resets game progress: player, missions, heists, owned assets, ledger and
 * activity — but KEEPS your mission templates. Fresh start, same routine.
 *
 * Run: npm run reset-game
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { dbConnect } = await import("../src/lib/db");
  const conn = await dbConnect();
  const db = conn.connection.db!;

  const wipe = ["players", "missions", "heists", "ownedassets", "ledgerentries", "activitydays"];
  for (const name of wipe) {
    const res = await db.collection(name).deleteMany({});
    console.log(`wiped ${name} (${res.deletedCount})`);
  }

  const templates = await db.collection("missiontemplates").countDocuments();
  console.log(`kept  missiontemplates (${templates})`);
  console.log("Fresh start. Go earn it.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
