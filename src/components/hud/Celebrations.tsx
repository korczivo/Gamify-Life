"use client";

import confetti from "canvas-confetti";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface CelebrationPayload {
  cashDelta?: number;
  rpDelta?: number;
  rankUp?: boolean;
  newRank?: number;
  missionName?: string;
  /** Show the big yellow MISSION PASSED splash. */
  missionPassed?: boolean;
  eliteAchieved?: boolean;
  /** Red error toast (e.g. "Not enough cash"). */
  error?: string;
}

const CelebrationContext = createContext<(p: CelebrationPayload) => void>(() => {});

export function useCelebration() {
  return useContext(CelebrationContext);
}

interface FloatingPayout {
  id: number;
  cash: number;
  rp: number;
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [floats, setFloats] = useState<FloatingPayout[]>([]);
  const [passed, setPassed] = useState<{ name: string; cash: number; elite?: boolean } | null>(
    null
  );
  const [rankUp, setRankUp] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nextId = useRef(1);

  const celebrate = useCallback((p: CelebrationPayload) => {
    if (p.error) {
      setErrorMsg(p.error);
      setTimeout(() => setErrorMsg(null), 2500);
      return;
    }
    if ((p.cashDelta && p.cashDelta !== 0) || p.rpDelta) {
      const id = nextId.current++;
      setFloats((f) => [...f, { id, cash: p.cashDelta ?? 0, rp: p.rpDelta ?? 0 }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1700);
    }
    if (p.missionPassed && p.missionName) {
      setPassed({ name: p.missionName, cash: p.cashDelta ?? 0, elite: p.eliteAchieved });
      setTimeout(() => setPassed(null), 2700);
    }
    if (p.rankUp && p.newRank) {
      // Let MISSION PASSED play first, then the rank-up.
      setTimeout(() => {
        setRankUp(p.newRank!);
        confetti({
          particleCount: 160,
          spread: 75,
          origin: { y: 0.4 },
          colors: ["#9dfb53", "#54c7fc", "#e8b71a"],
        });
        setTimeout(() => setRankUp(null), 2600);
      }, p.missionPassed ? 1300 : 0);
    }
  }, []);

  return (
    <CelebrationContext.Provider value={celebrate}>
      {children}

      {/* floating payouts near the HUD cash counter */}
      <div className="pointer-events-none fixed left-60 top-16 z-50 flex flex-col gap-1">
        {floats.map((f) => (
          <div key={f.id} className="animate-float-up flex items-baseline gap-3">
            {f.cash !== 0 && (
              <span
                className={`display-font text-xl ${f.cash > 0 ? "text-cash" : "text-danger"}`}
              >
                {f.cash > 0 ? "+" : "−"}${Math.abs(f.cash).toLocaleString("en-US")}
              </span>
            )}
            {f.rp > 0 && (
              <span className="hud-label text-sm font-bold text-rp">
                +{f.rp.toLocaleString("en-US")} RP
              </span>
            )}
          </div>
        ))}
      </div>

      {/* error toast */}
      {errorMsg && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2">
          <div className="hud-label animate-mission-passed rounded border border-danger/60 bg-panel px-4 py-2 text-sm font-bold text-danger shadow-lg">
            ✕ {errorMsg}
          </div>
        </div>
      )}

      {/* MISSION PASSED splash */}
      {passed && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="animate-mission-passed text-center">
            <div className="display-font text-6xl text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
              Mission passed
            </div>
            <div className="hud-label mt-3 text-lg text-white/90">{passed.name}</div>
            <div className="display-font mt-2 text-3xl text-cash">
              +${passed.cash.toLocaleString("en-US")}
            </div>
            {passed.elite && (
              <div className="hud-label mt-2 text-sm font-bold text-gold">
                ELITE CHALLENGE COMPLETE
              </div>
            )}
          </div>
        </div>
      )}

      {/* RANK UP overlay */}
      {rankUp !== null && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="animate-mission-passed text-center">
            <div className="hud-label text-xl text-rp">You've reached</div>
            <div className="display-font text-8xl text-rp drop-shadow-[0_0_24px_rgba(84,199,252,0.7)]">
              Rank {rankUp}
            </div>
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  );
}
