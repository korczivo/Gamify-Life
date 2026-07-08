"use client";

import { useCallback, useEffect, useState } from "react";
import { completeMissionAction } from "@/actions/missions";
import { useCelebration } from "./Celebrations";

export interface TimerState {
  missionId: string;
  name: string;
  endsAt: number; // epoch ms — survives refresh via localStorage
  durationMinutes: number;
}

const KEY = "empire.timer";
export const TIMER_EVENT = "empire:timer";

export function readTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

export function startTimer(state: TimerState) {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(TIMER_EVENT));
}

export function clearTimer() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(TIMER_EVENT));
}

function chime() {
  try {
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.15 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.6);
    });
  } catch {
    // audio is a nice-to-have
  }
}

/** Mounted in the HUD: shows the running deep-work session and auto-completes it. */
export function HudTimer() {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState(false);
  const celebrate = useCelebration();

  useEffect(() => {
    setTimer(readTimer());
    const sync = () => setTimer(readTimer());
    window.addEventListener(TIMER_EVENT, sync);
    window.addEventListener("storage", sync);
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener(TIMER_EVENT, sync);
      window.removeEventListener("storage", sync);
      clearInterval(interval);
    };
  }, []);

  const finish = useCallback(
    async (t: TimerState) => {
      setFinishing(true);
      try {
        const result = await completeMissionAction(t.missionId);
        clearTimer();
        if (result.ok) {
          chime();
          celebrate({ ...result, missionPassed: true });
        }
      } finally {
        setFinishing(false);
      }
    },
    [celebrate]
  );

  useEffect(() => {
    if (timer && !finishing && now >= timer.endsAt) {
      void finish(timer);
    }
  }, [timer, now, finishing, finish]);

  if (!timer) return null;

  const remaining = Math.max(0, timer.endsAt - now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="flex items-center gap-3 rounded-sm border border-gold/40 bg-panel-2 px-3 py-1.5">
      <span className="hud-label max-w-44 truncate text-xs text-white/80">{timer.name}</span>
      <span className="font-[family-name:var(--font-lcd)] text-lg text-gold tabular-nums">
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </span>
      <button
        onClick={() => clearTimer()}
        className="hud-label text-[10px] text-muted hover:text-danger"
        title="Abandon session (no payout, no penalty)"
      >
        ✕
      </button>
    </div>
  );
}
