import type { Metadata } from "next";
import { ensurePeriodMissions, serialize } from "@/lib/game";
import { dbConnect } from "@/lib/db";
import { Mission } from "@/lib/models/Mission";
import { MissionTemplate } from "@/lib/models/MissionTemplate";
import { ActivityDay } from "@/lib/models/ActivityDay";
import { dayKey, weekKey } from "@/lib/dates";
import type { SerializedMission, SerializedTemplate } from "@/lib/types";
import { MissionCard } from "@/components/missions/MissionCard";
import { MissionForms } from "@/components/missions/MissionForms";

export const metadata: Metadata = { title: "Missions — EMPIRE" };
export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  await dbConnect();
  await ensurePeriodMissions();

  const dk = dayKey();
  const wk = weekKey();

  const [today, thisWeek, preps, templates, activity] = await Promise.all([
    Mission.find({ periodKey: dk, heistId: null }).sort({ status: 1, createdAt: 1 }).lean(),
    Mission.find({ periodKey: wk }).sort({ status: 1, createdAt: 1 }).lean(),
    Mission.find({ heistId: { $ne: null }, status: "open" }).sort({ createdAt: 1 }).lean(),
    MissionTemplate.find({}).sort({ sortOrder: 1 }).lean(),
    ActivityDay.findOne({ dayKey: dk }).lean(),
  ]);
  const hardDoneToday = activity?.hardCompleted ?? 0;

  const sToday = serialize<SerializedMission[]>(today);
  const sWeek = serialize<SerializedMission[]>(thisWeek);
  const sPreps = serialize<SerializedMission[]>(preps);
  const sTemplates = serialize<SerializedTemplate[]>(templates);

  const doneToday = sToday.filter((m) => m.status === "completed").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="hud-label text-lg text-white">Today&apos;s jobs</h1>
          <span className="hud-label text-xs text-muted">
            {doneToday}/{sToday.length} done · {dk}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {sToday.length === 0 && (
            <p className="rounded border border-line bg-panel px-4 py-6 text-center text-sm text-muted">
              No jobs on the board. Add one below.
            </p>
          )}
          {sToday.map((m) => (
            <MissionCard key={m._id} mission={m} hardDoneToday={hardDoneToday} />
          ))}
        </div>
      </section>

      {sPreps.length > 0 && (
        <section>
          <h2 className="hud-label mb-3 text-lg text-white">Heist preps</h2>
          <div className="flex flex-col gap-2">
            {sPreps.map((m) => (
              <MissionCard key={m._id} mission={m} />
            ))}
          </div>
        </section>
      )}

      {sWeek.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="hud-label text-lg text-white">This week</h2>
            <span className="hud-label text-xs text-muted">{wk}</span>
          </div>
          <div className="flex flex-col gap-2">
            {sWeek.map((m) => (
              <MissionCard key={m._id} mission={m} hardDoneToday={hardDoneToday} />
            ))}
          </div>
        </section>
      )}

      <MissionForms templates={sTemplates} />
    </div>
  );
}
