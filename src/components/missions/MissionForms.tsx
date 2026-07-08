"use client";

import { useState, useTransition } from "react";
import type { SerializedTemplate } from "@/lib/types";
import {
  addOneOffAction,
  createTemplateAction,
  deleteTemplateAction,
  setTemplateActiveAction,
} from "@/actions/missions";
import type { BusinessType, Difficulty, ObjectiveType } from "@/lib/economy";

const inputCls =
  "rounded border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-cash/60";

export function MissionForms({ templates }: { templates: SerializedTemplate[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>("marketing");
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>("checkbox");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [targetCount, setTargetCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [schedule, setSchedule] = useState<"oneoff" | "daily" | "weekly">("oneoff");
  const [timesPerPeriod, setTimesPerPeriod] = useState(1);

  const submit = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const base = {
        name: name.trim(),
        businessType,
        objectiveType,
        difficulty,
        targetCount,
        durationMinutes,
      };
      if (schedule === "oneoff") await addOneOffAction(base);
      else await createTemplateAction({ ...base, scheduleKind: schedule, timesPerPeriod });
      setName("");
    });
  };

  return (
    <div className="rounded border border-line bg-panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="hud-label flex w-full items-center justify-between px-4 py-3 text-sm text-muted hover:text-white"
      >
        <span>+ New job / recurring job</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1">
              <span className="hud-label text-xs text-muted">Job name</span>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Send 10 cold DMs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label text-xs text-muted">Type</span>
              <select
                className={inputCls}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
              >
                <option value="marketing">Marketing</option>
                <option value="content">Content</option>
                <option value="dev">Dev</option>
                <option value="admin">Ops/Admin</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label text-xs text-muted">Objective</span>
              <select
                className={inputCls}
                value={objectiveType}
                onChange={(e) => setObjectiveType(e.target.value as ObjectiveType)}
              >
                <option value="checkbox">Checkbox</option>
                <option value="counter">Counter (x/N)</option>
                <option value="timer">Timer</option>
              </select>
            </label>
            {objectiveType === "counter" && (
              <label className="flex flex-col gap-1">
                <span className="hud-label text-xs text-muted">Target</span>
                <input
                  type="number"
                  min={2}
                  className={`${inputCls} w-20`}
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                />
              </label>
            )}
            {objectiveType === "timer" && (
              <label className="flex flex-col gap-1">
                <span className="hud-label text-xs text-muted">Minutes</span>
                <input
                  type="number"
                  min={5}
                  className={`${inputCls} w-20`}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="hud-label text-xs text-muted">Difficulty</span>
              <select
                className={inputCls}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="easy">Easy · $8k</option>
                <option value="medium">Medium · $20k</option>
                <option value="hard">Hard · $50k</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label text-xs text-muted">Schedule</span>
              <select
                className={inputCls}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as typeof schedule)}
              >
                <option value="oneoff">One-off (today)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            {schedule !== "oneoff" && (
              <label className="flex flex-col gap-1">
                <span className="hud-label text-xs text-muted">× per {schedule === "daily" ? "day" : "week"}</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className={`${inputCls} w-16`}
                  value={timesPerPeriod}
                  onChange={(e) => setTimesPerPeriod(Number(e.target.value))}
                />
              </label>
            )}
            <button
              onClick={submit}
              disabled={pending || !name.trim()}
              className="hud-label rounded border border-cash/50 bg-cash/10 px-5 py-2 text-sm font-bold text-cash hover:bg-cash/20 disabled:opacity-40"
            >
              Add
            </button>
          </div>

          {templates.length > 0 && (
            <div className="mt-5">
              <div className="hud-label mb-2 text-xs text-muted">Recurring jobs</div>
              <div className="flex flex-col gap-1.5">
                {templates.map((t) => (
                  <div
                    key={t._id}
                    className="flex items-center gap-3 rounded bg-panel-2 px-3 py-2 text-sm"
                  >
                    <span className={`flex-1 truncate ${t.active ? "" : "text-muted line-through"}`}>
                      {t.name}
                    </span>
                    <span className="hud-label text-xs text-muted">
                      {t.schedule.kind} ×{t.schedule.timesPerPeriod}
                    </span>
                    <button
                      onClick={() =>
                        startTransition(() => setTemplateActiveAction(t._id, !t.active))
                      }
                      className={`hud-label text-xs ${t.active ? "text-cash" : "text-muted"}`}
                    >
                      {t.active ? "Active" : "Paused"}
                    </button>
                    <button
                      onClick={() => startTransition(() => deleteTemplateAction(t._id))}
                      className="hud-label text-xs text-muted hover:text-danger"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
