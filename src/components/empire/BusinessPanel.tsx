"use client";

import Image from "next/image";
import { useTransition } from "react";
import { buySuppliesAction, buyUpgradeAction, sellStockAction } from "@/actions/empire";
import { useCelebration } from "@/components/hud/Celebrations";
import {
  EQUIPMENT_VALUE_MULT,
  FULLNESS_BONUS_MAX,
  OFFICE_SALE_BONUS,
  SUPPLY_MAX,
  SUPPLY_UNIT_COST,
  type AssetDef,
} from "@/lib/economy";
import type { SerializedOwnedAsset } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  marketing: "Marketing",
  content: "Content",
  dev: "Dev",
  admin: "Ops/Admin",
};

function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  return (
    <div>
      <div className="hud-label mb-1 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-sm bg-panel-2">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function BusinessPanel({
  def,
  owned,
  hasOfficeBonus,
}: {
  def: AssetDef;
  owned: SerializedOwnedAsset;
  hasOfficeBonus: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();

  const staff = owned.upgrades.includes("staff");
  const equipment = owned.upgrades.includes("equipment");
  const cap = def.stockCap ?? 1;
  const units = Math.floor(owned.stockUnits);
  const fullness = 1 + FULLNESS_BONUS_MAX * (owned.stockUnits / cap);
  const sellValue = Math.round(
    units *
      (def.unitValue ?? 0) *
      (equipment ? EQUIPMENT_VALUE_MULT : 1) *
      fullness *
      (hasOfficeBonus ? 1 + OFFICE_SALE_BONUS : 1)
  );
  const supplyMissing = SUPPLY_MAX - owned.supplyUnits;
  const supplyCost = Math.round(supplyMissing * SUPPLY_UNIT_COST);
  const producing = def.isNightclub ? true : owned.supplyUnits > 0;

  return (
    <div
      className={`rounded border bg-panel p-4 ${
        owned.stockUnits >= cap ? "border-cash/60 animate-pulse-glow" : "border-line"
      }`}
    >
      <div className="flex items-center gap-3">
        {def.map && (
          <Image
            src={`/map/blips/${def.map.blip}.png`}
            alt=""
            width={28}
            height={28}
            className={producing ? "" : "opacity-40 grayscale"}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{def.name}</div>
          <div className="hud-label text-[11px] text-muted">{def.tagline}</div>
        </div>
        <span
          className={`hud-label rounded-sm px-2 py-0.5 text-[10px] ${
            producing ? "bg-cash/15 text-cash" : "bg-panel-2 text-muted"
          }`}
        >
          {def.isNightclub ? "Accruing" : producing ? "Producing" : "No supplies"}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {!def.isNightclub && (
          <Bar value={owned.supplyUnits} max={SUPPLY_MAX} color="#54c7fc" label="Supplies" />
        )}
        <Bar value={owned.stockUnits} max={cap} color="#9dfb53" label="Stock" />
      </div>

      {/* how this thing actually runs */}
      <div
        className={`hud-label mt-2.5 rounded-sm px-2 py-1.5 text-[11px] ${
          !def.isNightclub && owned.supplyUnits <= 0
            ? "bg-rp/10 text-rp"
            : "bg-panel-2 text-muted"
        }`}
      >
        {def.isNightclub
          ? "⚙ Accrues goods from your other businesses with every mission you complete"
          : `⚙ Complete ${TYPE_LABEL[def.businessType!]} missions to resupply — every finished mission runs production`}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() =>
            startTransition(async () => {
              const r = await sellStockAction(owned.assetId);
              celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
            })
          }
          disabled={pending || units < 1}
          className="hud-label rounded border border-cash/50 bg-cash/10 px-4 py-1.5 text-sm font-bold text-cash hover:bg-cash/20 disabled:opacity-40"
        >
          Sell{units >= 1 ? ` · $${sellValue.toLocaleString("en-US")}` : ""}
        </button>
        {!def.isNightclub && (
          <button
            onClick={() =>
              startTransition(async () => {
                const r = await buySuppliesAction(owned.assetId);
                celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
              })
            }
            disabled={pending || supplyMissing <= 0.01}
            className="hud-label rounded border border-line px-3 py-1.5 text-xs text-muted hover:text-white hover:bg-panel-2 disabled:opacity-40"
            title="A bad deal on purpose — missions deliver supplies for free"
          >
            Emergency resupply · ${supplyCost.toLocaleString("en-US")}
          </button>
        )}
        <span className="hud-label ml-auto text-[11px] text-muted">
          Earned ${owned.totalEarned.toLocaleString("en-US")}
        </span>
      </div>

      {def.upgrades && def.upgrades.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {def.upgrades.map((up) => {
            const has = owned.upgrades.includes(up.id);
            return (
              <button
                key={up.id}
                onClick={() =>
                  startTransition(async () => {
                    const r = await buyUpgradeAction(owned.assetId, up.id);
                    celebrate(r.ok ? { cashDelta: r.cashDelta } : { error: r.error });
                  })
                }
                disabled={pending || has}
                className={`hud-label rounded px-2.5 py-1 text-[11px] ${
                  has
                    ? "bg-cash/15 text-cash"
                    : "border border-line text-muted hover:text-white hover:bg-panel-2"
                }`}
                title={up.effect}
              >
                {has ? "✓ " : ""}
                {up.name}
                {!has && ` · $${up.price.toLocaleString("en-US")}`}
              </button>
            );
          })}
          {staff && equipment && (
            <span className="hud-label text-[11px] text-gold">Fully upgraded</span>
          )}
        </div>
      )}
    </div>
  );
}
