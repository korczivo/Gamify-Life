"use client";

import { useState, useTransition } from "react";
import type { SerializedMission } from "@/lib/types";
import { completeMissionAction, incrementProgressAction } from "@/actions/missions";
import { useCelebration } from "@/components/hud/Celebrations";

function tick() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "square";
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // sound optional
  }
}

export function MissionControls({ mission }: { mission: SerializedMission }) {
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();
  const [optimisticProgress, setOptimisticProgress] = useState(mission.progress);

  const onComplete = () =>
    startTransition(async () => {
      const result = await completeMissionAction(mission._id);
      if (result.ok) celebrate({ ...result, missionPassed: true });
    });

  const onIncrement = () =>
    startTransition(async () => {
      const result = await incrementProgressAction(mission._id);
      if (!result.ok) return;
      if (result.completed) {
        celebrate({ ...result, missionPassed: true });
      } else {
        tick();
        setOptimisticProgress(result.progress ?? optimisticProgress + 1);
      }
    });

  if (mission.objectiveType === "counter") {
    const target = mission.targetCount ?? 1;
    const progress = Math.max(mission.progress, optimisticProgress);
    return (
      <div className="flex items-center gap-3">
        <div className="w-28">
          <div className="hud-label mb-1 text-right text-xs text-muted">
            {progress}/{target}
          </div>
          <div className="h-1.5 overflow-hidden rounded-sm bg-panel-2">
            <div
              className="h-full bg-cash transition-all duration-300"
              style={{ width: `${Math.round((progress / target) * 100)}%` }}
            />
          </div>
        </div>
        <button
          onClick={onIncrement}
          disabled={pending}
          className="hud-label rounded border border-cash/50 bg-cash/10 px-4 py-2 text-sm font-bold text-cash hover:bg-cash/20 disabled:opacity-50"
        >
          +1
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onComplete}
      disabled={pending}
      className="hud-label rounded border border-cash/50 bg-cash/10 px-4 py-2 text-sm font-bold text-cash hover:bg-cash/20 disabled:opacity-50"
    >
      Done
    </button>
  );
}
