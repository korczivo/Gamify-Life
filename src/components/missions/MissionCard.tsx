import type { SerializedMission } from "@/lib/types";
import { hardSaturationMult } from "@/lib/economy";
import { MissionControls } from "./MissionControls";

const TYPE_STYLE: Record<SerializedMission["businessType"], { label: string; cls: string }> = {
  marketing: { label: "Marketing", cls: "text-[#ff8a5c] bg-[#ff8a5c]/10" },
  content: { label: "Content", cls: "text-[#d68cff] bg-[#d68cff]/10" },
  dev: { label: "Dev", cls: "text-rp bg-rp/10" },
  admin: { label: "Ops", cls: "text-gold bg-gold/10" },
};

export function MissionCard({
  mission,
  hardDoneToday = 0,
}: {
  mission: SerializedMission;
  /** Completed hard missions today — drives the saturation badge. */
  hardDoneToday?: number;
}) {
  const done = mission.status === "completed";
  const type = TYPE_STYLE[mission.businessType];
  const isHard = mission.difficulty === "hard" && !mission.heistId;
  const saturation = isHard ? hardSaturationMult(hardDoneToday) : 1;

  return (
    <div
      className={`relative flex items-center gap-4 rounded border border-line bg-panel px-4 py-3 ${
        done ? "opacity-45" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`hud-label rounded-sm px-1.5 py-0.5 text-[10px] ${type.cls}`}>
            {type.label}
          </span>
          {mission.prepKind && (
            <span
              className={`hud-label rounded-sm px-1.5 py-0.5 text-[10px] ${
                mission.prepKind === "mandatory"
                  ? "bg-danger/15 text-danger"
                  : "bg-gold/15 text-gold"
              }`}
            >
              Heist prep · {mission.prepKind}
            </span>
          )}
        </div>
        <div className={`mt-1 truncate font-medium ${done ? "line-through" : ""}`}>
          {mission.name}
        </div>
        <div className="hud-label mt-0.5 text-xs text-muted">
          <span className="text-cash">
            ${Math.round(mission.cashReward * saturation).toLocaleString("en-US")}
          </span>
          <span className="mx-1.5">·</span>
          <span className="text-rp">
            {Math.round(mission.rpReward * saturation).toLocaleString("en-US")} RP
          </span>
          {!done && isHard && saturation < 1 && (
            <span className="ml-1.5 text-gold">
              market saturated · {Math.round(saturation * 100)}%
            </span>
          )}
        </div>
      </div>

      {done ? (
        <span className="hud-label animate-stamp-in rounded border-2 border-cash px-2 py-0.5 text-sm font-bold text-cash">
          Done
        </span>
      ) : (
        <MissionControls mission={mission} />
      )}
    </div>
  );
}
