"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeMissionAction } from "@/actions/missions";
import { archiveHeistAction, finishHeistAction, scopeHeistAction } from "@/actions/heists";
import { useCelebration } from "@/components/hud/Celebrations";
import {
  ELITE_BONUS,
  HARD_MODE_MULT,
  LOOT_TABLE,
  LOOT_TABLE_CAYO,
  OPTIONAL_PREP_BONUS,
} from "@/lib/economy";
import type { SerializedHeist } from "@/lib/types";
import confetti from "canvas-confetti";

const POLAROID_TILT = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1", "rotate-3", "-rotate-3"];

export function HeistBoard({ heist }: { heist: SerializedHeist }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();
  const [rolling, setRolling] = useState(false);
  const [rollDisplay, setRollDisplay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mandatory = heist.preps.filter((p) => p.kind === "mandatory");
  const optional = heist.preps.filter((p) => p.kind === "optional");
  const mandatoryDone = mandatory.every((p) => p.completed);
  const optionalDone = optional.filter((p) => p.completed).length;

  const lootMult = heist.loot?.multiplier ?? 1;
  const currentPayout = Math.round(
    heist.basePayout *
      lootMult *
      (1 + OPTIONAL_PREP_BONUS * optionalDone) *
      (heist.hardMode ? HARD_MODE_MULT : 1)
  );

  const scope = () => {
    setError(null);
    startTransition(async () => {
      const r = await scopeHeistAction(heist._id);
      if (!r.ok || !r.loot) {
        setError(r.error ?? "Scope failed");
        return;
      }
      // Roulette: cycle the table, land on the actual roll.
      setRolling(true);
      const table = heist.tier === "cayo" ? LOOT_TABLE_CAYO : LOOT_TABLE;
      const kinds = table.map((l) => l.kind);
      let i = 0;
      const spins = 14 + kinds.indexOf(r.loot.kind);
      const interval = setInterval(() => {
        setRollDisplay(kinds[i % kinds.length]);
        i++;
        if (i > spins) {
          clearInterval(interval);
          setRollDisplay(r.loot!.kind);
          setRolling(false);
          if (r.loot!.multiplier >= 1.5) {
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.4 } });
          }
          setTimeout(() => router.refresh(), 900);
        }
      }, 110);
    });
  };

  const completePrep = (missionId: string) =>
    startTransition(async () => {
      const r = await completeMissionAction(missionId);
      if (r.ok) celebrate({ ...r, missionPassed: false });
    });

  const finale = () =>
    startTransition(async () => {
      const r = await finishHeistAction(heist._id);
      if (!r.ok) {
        setError(r.error ?? "Finale failed");
        return;
      }
      confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
      celebrate({ ...r, missionPassed: true, eliteAchieved: r.eliteAchieved });
      setTimeout(() => router.push("/heists"), 2600);
    });

  return (
    <div className="rounded border border-line bg-[#191512] p-6 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="display-font text-3xl text-white/90">{heist.name}</h1>
        {heist.hardMode && (
          <span className="hud-label rounded-sm bg-danger/20 px-2 py-0.5 text-xs font-bold text-danger">
            💀 Hard mode ×{HARD_MODE_MULT}
          </span>
        )}
        <button
          onClick={() => startTransition(async () => {
            await archiveHeistAction(heist._id);
            router.push("/heists");
          })}
          className="hud-label ml-auto text-xs text-muted hover:text-danger"
        >
          Abandon (archive)
        </button>
      </div>

      {/* loot / scope */}
      <div className="mt-5">
        {heist.status === "scoping" ? (
          <div className="rounded border border-dashed border-gold/40 bg-black/30 p-5 text-center">
            <div className="hud-label text-sm text-muted">
              First things first — scope out the target to see what&apos;s in the vault.
            </div>
            {rollDisplay && (
              <div
                className={`display-font mt-3 text-4xl ${rolling ? "text-white/70" : "text-gold"}`}
              >
                {rollDisplay}
              </div>
            )}
            {!rolling && !rollDisplay && (
              <button
                onClick={scope}
                disabled={pending}
                className="hud-label mt-3 rounded border border-gold/50 bg-gold/10 px-6 py-2.5 text-sm font-bold text-gold hover:bg-gold/20 disabled:opacity-40"
              >
                🔭 Scope out the target
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-6 rounded border border-line bg-black/30 px-5 py-3">
            <div>
              <div className="hud-label text-[11px] text-muted">Target</div>
              <div className="display-font text-2xl text-gold">
                {heist.loot?.kind} ×{lootMult}
              </div>
            </div>
            <div>
              <div className="hud-label text-[11px] text-muted">Current take</div>
              <div className="display-font text-2xl text-cash">
                ${currentPayout.toLocaleString("en-US")}
              </div>
            </div>
            <div className="hud-label ml-auto text-right text-[11px] leading-relaxed text-muted">
              +{Math.round(OPTIONAL_PREP_BONUS * 100)}% per optional prep ·{" "}
              +{Math.round(ELITE_BONUS * 100)}% Elite
              <br />
              Elite: all preps + finale within 7 days + no day skipped
            </div>
          </div>
        )}
      </div>

      {/* preps as pinned polaroids */}
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {heist.preps.map((p, i) => (
          <div
            key={p._id}
            className={`relative bg-[#f5f0e6] p-2 pb-3 text-black shadow-[0_6px_16px_rgba(0,0,0,0.5)] ${POLAROID_TILT[i % POLAROID_TILT.length]}`}
          >
            <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-danger shadow" />
            <div className="flex h-20 items-center justify-center bg-[#20242a] px-2 text-center">
              <span className="hud-label text-xs text-white/85">{p.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <span
                className={`hud-label text-[10px] font-bold ${
                  p.kind === "mandatory" ? "text-danger" : "text-[#8a6d00]"
                }`}
              >
                {p.kind}
              </span>
              {p.completed ? (
                <span className="hud-label animate-stamp-in rounded border-2 border-cash bg-cash/10 px-1.5 text-[11px] font-bold text-[#237a00]">
                  DONE
                </span>
              ) : heist.status === "active" ? (
                <button
                  onClick={() => completePrep(p.missionId)}
                  disabled={pending}
                  className="hud-label rounded bg-black/85 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-black disabled:opacity-40"
                >
                  Complete
                </button>
              ) : (
                <span className="hud-label text-[10px] text-black/40">scope first</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="hud-label mt-4 text-xs text-danger">{error}</p>}

      {/* finale */}
      {heist.status === "active" && (
        <button
          onClick={finale}
          disabled={pending || !mandatoryDone}
          className={`hud-label mt-7 w-full rounded py-4 text-lg font-bold transition-all ${
            mandatoryDone
              ? "border-2 border-cash bg-cash/15 text-cash animate-pulse-glow hover:bg-cash/25"
              : "border border-line bg-panel-2 text-muted"
          }`}
        >
          {mandatoryDone
            ? `🎬 ${heist.finaleName} — take $${currentPayout.toLocaleString("en-US")}`
            : `${heist.finaleName} — ${mandatory.filter((p) => !p.completed).length} mandatory preps left`}
        </button>
      )}
    </div>
  );
}
