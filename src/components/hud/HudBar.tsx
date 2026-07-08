import { getPlayer } from "@/lib/game";
import { rpForRank } from "@/lib/economy";
import { CashCounter } from "./CashCounter";
import { HudTimer } from "./HudTimer";

export async function HudBar() {
  const player = await getPlayer();
  const rankStart = rpForRank(player.rank);
  const rankEnd = rpForRank(player.rank + 1);
  const progress = Math.min(
    1,
    (player.totalRp - rankStart) / Math.max(1, rankEnd - rankStart)
  );

  return (
    <header className="flex items-center gap-6 border-b border-line bg-panel px-6 py-3">
      <CashCounter value={player.cash} />

      <div className="flex items-center gap-3 min-w-56">
        <span className="hud-label text-xs text-rp">RP</span>
        <div className="h-2.5 flex-1 rounded-sm bg-panel-2 overflow-hidden">
          <div
            className="h-full bg-rp transition-all duration-700"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span
          className="hud-label rounded-sm bg-rp/15 px-2 py-0.5 text-sm font-semibold text-rp"
          title={`${player.totalRp.toLocaleString()} RP`}
        >
          RANK {player.rank}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <HudTimer />
      </div>
    </header>
  );
}
