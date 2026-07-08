import type { Metadata } from "next";
import { dbConnect } from "@/lib/db";
import { getPlayer } from "@/lib/game";
import { LedgerEntry } from "@/lib/models/LedgerEntry";
import { OwnedAsset } from "@/lib/models/OwnedAsset";
import { ActivityDay } from "@/lib/models/ActivityDay";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { buildNetWorthSeries } from "@/lib/networth";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";

export const metadata: Metadata = { title: "Stats — EMPIRE" };
export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { icon: string; label: string }> = {
  MISSION_PAYOUT: { icon: "✅", label: "Mission" },
  HEIST_PAYOUT: { icon: "💎", label: "Heist" },
  STOCK_SALE: { icon: "📦", label: "Stock sale" },
  SAFE_COLLECT: { icon: "🔐", label: "Safe" },
  ASSET_PURCHASE: { icon: "🏢", label: "Purchase" },
  UPGRADE_PURCHASE: { icon: "🔧", label: "Upgrade" },
  SUPPLY_PURCHASE: { icon: "🚚", label: "Supplies" },
  HEIST_BUYIN: { icon: "🎯", label: "Buy-in" },
  REFUND: { icon: "↩️", label: "Refund" },
};

export default async function StatsPage() {
  await dbConnect();
  const nwSeries = await buildNetWorthSeries();
  const [player, entries, owned, activity] = await Promise.all([
    getPlayer(),
    LedgerEntry.find({}).sort({ createdAt: -1 }).limit(60).lean(),
    OwnedAsset.find({}).lean(),
    ActivityDay.find({}).lean(),
  ]);

  const latest = entries[0];
  const netWorth = latest?.netWorthAfter ?? player.cash;
  const totalMissions = activity.reduce((s, d) => s + d.missionsCompleted, 0);
  const totalDeepWork = activity.reduce((s, d) => s + d.deepWorkMinutes, 0);
  const assetsValue = owned.reduce((s, o) => s + o.purchasePrice, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Net worth", value: `$${netWorth.toLocaleString("en-US")}`, cls: "text-cash" },
          { label: "Assets owned", value: `$${assetsValue.toLocaleString("en-US")}`, cls: "text-gold" },
          { label: "Missions completed", value: totalMissions.toLocaleString("en-US"), cls: "text-white" },
          { label: "Deep work", value: `${Math.floor(totalDeepWork / 60)}h ${totalDeepWork % 60}m`, cls: "text-rp" },
        ].map((tile) => (
          <div key={tile.label} className="rounded border border-line bg-panel p-4">
            <div className="hud-label text-xs text-muted">{tile.label}</div>
            <div className={`display-font mt-1 text-2xl ${tile.cls}`}>{tile.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded border border-line bg-panel p-4">
        <h2 className="hud-label mb-3 text-sm text-white">Net worth</h2>
        <NetWorthChart series={nwSeries} height={220} />
      </section>

      <section className="rounded border border-line bg-panel p-4">
        <h2 className="hud-label mb-3 text-sm text-white">The grind — last 20 weeks</h2>
        <ActivityHeatmap />
      </section>

      <section className="rounded border border-line bg-panel p-4">
        <h2 className="hud-label mb-3 text-sm text-white">Ledger</h2>
        <div className="flex flex-col">
          {entries.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              No transactions yet — go run a mission.
            </p>
          )}
          {entries.map((e) => {
            const meta = TYPE_META[e.type] ?? { icon: "•", label: e.type };
            return (
              <div
                key={String(e._id)}
                className="flex items-center gap-3 border-b border-line/50 py-2 last:border-0"
              >
                <span className="w-6 text-center">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{e.note}</div>
                  <div className="hud-label text-[11px] text-muted">
                    {meta.label} · {e.dayKey}
                  </div>
                </div>
                {e.amountRp > 0 && (
                  <span className="hud-label text-xs text-rp">+{e.amountRp} RP</span>
                )}
                <span
                  className={`display-font w-28 text-right text-lg ${
                    e.amountCash >= 0 ? "text-cash" : "text-danger"
                  }`}
                >
                  {e.amountCash >= 0 ? "+" : "−"}$
                  {Math.abs(e.amountCash).toLocaleString("en-US")}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
