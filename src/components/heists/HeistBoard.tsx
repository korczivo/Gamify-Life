"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { completeMissionAction } from "@/actions/missions";
import {
  archiveHeistAction,
  finishHeistAction,
  startPrepTimerAction,
  stopPrepTimerAction,
} from "@/actions/heists";
import { useCelebration } from "@/components/hud/Celebrations";
import {
  ELITE_BONUS,
  ELITE_WINDOW_DAYS,
  HARD_MODE_MULT,
  OPTIONAL_PREP_BONUS,
  formatMinutes,
  heistMandatoryMinutes,
} from "@/lib/economy";
import type { SerializedHeist } from "@/lib/types";
import confetti from "canvas-confetti";

const POLAROID_TILT = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1", "rotate-3", "-rotate-3"];

type Prep = SerializedHeist["preps"][number];

/** Live banked SECONDS for a prep — adds the running timer's elapsed time. */
function liveSeconds(p: Prep, nowMs: number): number {
  const targetSec = (p.target ?? 1) * 60;
  const baseSec = (p.progress ?? 0) * 60;
  if (p.completed || !p.runningSince) return Math.min(targetSec, baseSec);
  const elapsed = (nowMs - Date.parse(p.runningSince)) / 1000;
  return Math.min(targetSec, baseSec + Math.max(0, elapsed));
}

/** Live banked minutes (for the aggregate bar). */
function liveMinutes(p: Prep, nowMs: number): number {
  return liveSeconds(p, nowMs) / 60;
}

/** Seconds -> "MM:SS" clock. */
function clock(totalSec: number): string {
  const s = Math.floor(totalSec);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function HeistBoard({
  heist,
  art,
}: {
  heist: SerializedHeist;
  art?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const stopping = useRef<Set<string>>(new Set());

  const anyRunning = heist.preps.some((p) => p.runningSince && !p.completed);

  // Tick once a second while any timer runs, so the banked bars count up live.
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const optional = heist.preps.filter((p) => p.kind === "optional");
  const optionalDone = optional.filter((p) => p.completed).length;
  const allDone = heist.preps.every((p) => p.completed);

  const gateMinutes = heistMandatoryMinutes(heist.preps) || heist.preps.reduce((s, p) => s + (p.target ?? 0), 0);
  const bankedMinutes = heist.preps.reduce((s, p) => s + liveMinutes(p, nowMs), 0);

  const lootMult = heist.loot?.multiplier ?? 1;
  const currentPayout = Math.round(
    heist.basePayout *
      lootMult *
      (1 + OPTIONAL_PREP_BONUS * optionalDone) *
      (heist.hardMode ? HARD_MODE_MULT : 1)
  );

  const startPrep = (prepId: string) =>
    startTransition(async () => {
      const r = await startPrepTimerAction(heist._id, prepId);
      if (!r.ok) setError(r.error ?? "Could not start the timer");
      else setNowMs(Date.now());
    });

  const stopPrep = (prepId: string) =>
    startTransition(async () => {
      const r = await stopPrepTimerAction(heist._id, prepId);
      stopping.current.delete(prepId);
      if (r.ok && r.heistTick) celebrate({ ...r, missionPassed: false });
    });

  // Auto-bank a prep the moment its live timer hits the target.
  useEffect(() => {
    for (const p of heist.preps) {
      if (!p.runningSince || p.completed) continue;
      if (liveMinutes(p, nowMs) >= (p.target ?? 1) && !stopping.current.has(p._id)) {
        stopping.current.add(p._id);
        stopPrep(p._id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs]);

  // Legacy heists: a prep was its own one-off mission, ticked by "Complete".
  const completeLegacyPrep = (missionId: string) =>
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
    <div className="overflow-hidden rounded border border-line bg-[#191512] p-6 shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]">
      {/* template art banner */}
      {art && (
        <div className="relative -mx-6 -mt-6 mb-5 h-44">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} alt="" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#191512] via-[#191512]/30 to-transparent" />
        </div>
      )}

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

      {/* loot */}
      <div className="mt-5">
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
            +{Math.round(ELITE_BONUS * 100)}% Elite
            <br />
            Elite: finish every prep within {ELITE_WINDOW_DAYS[heist.tier]} days +
            no day skipped
          </div>
        </div>
      </div>

      {/* preps as pinned polaroids — each is a deep-work timer */}
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {heist.preps.map((p, i) => {
          const targetSec = (p.target ?? 1) * 60;
          const liveSec = liveSeconds(p, nowMs);
          const pct = Math.min(100, (liveSec / targetSec) * 100);
          const running = Boolean(p.runningSince) && !p.completed;
          const isLegacy = Boolean(p.missionId) && !p.requirement;
          // Only one timer at a time: block others' Start while one runs.
          const blocked = anyRunning && !running;
          return (
            <div
              key={p._id}
              className={`relative bg-[#f5f0e6] p-2 pb-3 text-black shadow-[0_6px_16px_rgba(0,0,0,0.5)] ${POLAROID_TILT[i % POLAROID_TILT.length]} ${
                running ? "ring-4 ring-cash" : ""
              } ${blocked ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full shadow ${running ? "animate-pulse bg-cash" : p.completed ? "bg-[#237a00]" : "bg-danger"}`}
              />
              <div className="relative flex h-20 flex-col items-center justify-center gap-1 bg-[#20242a] px-2 text-center">
                {running && (
                  <span className="hud-label absolute left-1.5 top-1.5 flex items-center gap-1 text-[9px] font-bold text-cash">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cash" /> REC
                  </span>
                )}
                {p.flavor ? (
                  <>
                    <span className="display-font text-lg leading-none text-gold/90">
                      {p.flavor}
                    </span>
                    <span className="hud-label text-[10px] leading-snug text-white/70">
                      {p.name}
                    </span>
                  </>
                ) : (
                  <span className="hud-label text-xs text-white/85">{p.name}</span>
                )}
              </div>

              {/* live clock — the honest "am I counting" readout */}
              {!isLegacy && (
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span
                    className={`font-[family-name:var(--font-lcd)] text-2xl tabular-nums leading-none ${
                      p.completed ? "text-[#237a00]" : running ? "text-[#1f7a1f]" : "text-black/70"
                    }`}
                  >
                    {clock(liveSec)}
                  </span>
                  <span className="hud-label text-[10px] font-bold text-black/45">
                    / {formatMinutes(p.target ?? 0)}
                  </span>
                </div>
              )}

              {!isLegacy && (
                <div className="mt-1.5 px-1">
                  <div className="h-1.5 overflow-hidden rounded-sm bg-black/15">
                    <div
                      className={`h-full ${running ? "bg-cash" : "bg-[#237a00]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center justify-center px-1">
                {p.completed ? (
                  <span className="hud-label animate-stamp-in rounded border-2 border-cash bg-cash/10 px-2 py-0.5 text-[11px] font-bold text-[#237a00]">
                    DONE ✓
                  </span>
                ) : heist.status !== "active" ? null : isLegacy ? (
                  <button
                    onClick={() => completeLegacyPrep(p.missionId!)}
                    disabled={pending}
                    className="hud-label w-full rounded bg-black/85 px-2 py-1 text-[11px] font-bold text-white hover:bg-black disabled:opacity-40"
                  >
                    Complete
                  </button>
                ) : running ? (
                  <button
                    onClick={() => stopPrep(p._id)}
                    disabled={pending}
                    className="hud-label w-full rounded bg-danger/90 px-2 py-1 text-[11px] font-bold text-white hover:bg-danger disabled:opacity-40"
                  >
                    ⏸ Pause
                  </button>
                ) : (
                  <button
                    onClick={() => startPrep(p._id)}
                    disabled={pending || blocked}
                    title={blocked ? "Pause the running prep first" : undefined}
                    className="hud-label w-full rounded bg-[#237a00] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#2a9200] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ▶ {(p.progress ?? 0) > 0 ? "Resume" : "Start"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {heist.status === "active" && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="hud-label text-[11px] text-muted">Deep-work banked</span>
            <span className="hud-label text-[11px] font-bold text-white/80">
              {formatMinutes(bankedMinutes)} / {formatMinutes(gateMinutes)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-sm bg-black/40">
            <div
              className="h-full bg-cash transition-all"
              style={{
                width: `${gateMinutes ? Math.min(100, Math.round((bankedMinutes / gateMinutes) * 100)) : 0}%`,
              }}
            />
          </div>
          <p className="hud-label mt-3 text-center text-[11px] text-muted">
            Hit ▶ Start and sit through it — the clock counts up and banks your
            deep work. One timer at a time; ⏸ Pause to switch or take a break
            (banked time is kept). This is the score, not the missions page.
          </p>
        </div>
      )}

      {error && <p className="hud-label mt-4 text-xs text-danger">{error}</p>}

      {/* finale */}
      {heist.status === "active" && (
        <button
          onClick={finale}
          disabled={pending || !allDone}
          className={`hud-label mt-7 w-full rounded py-4 text-lg font-bold transition-all ${
            allDone
              ? "border-2 border-cash bg-cash/15 text-cash animate-pulse-glow hover:bg-cash/25"
              : "border border-line bg-panel-2 text-muted"
          }`}
        >
          {allDone
            ? `🎬 ${heist.finaleName} — take $${currentPayout.toLocaleString("en-US")}`
            : `${heist.finaleName} — ${heist.preps.filter((p) => !p.completed).length} preps left`}
        </button>
      )}
    </div>
  );
}
