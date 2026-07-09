"use client";

import { useMemo, useState } from "react";
import { GTA5_STORY } from "@/lib/story/gta5";
import {
  computeProgress,
  stepKey,
  orderedStepKeys,
  advanceOne,
  retreatOne,
  describeStep,
  PROTAGONIST_COLORS,
  PROTAGONIST_NAMES,
  type MissionProgress,
} from "@/lib/story/progress";
import { useStoryProgress } from "@/lib/story/useStoryProgress";
import { useDailyJobs } from "@/lib/story/useDailyJobs";
import { StoryMap } from "./StoryMap";

export function StoryExplorer() {
  const { completed, reset, hydrated, apply } = useStoryProgress();
  const jobsApi = useDailyJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lastAdvanced, setLastAdvanced] = useState<string | null>(null);

  const prog = useMemo(() => computeProgress(GTA5_STORY, completed), [completed]);
  const selected = prog.missions.find((m) => m.mission.id === selectedId) ?? null;
  const missionById = useMemo(
    () => new Map(prog.missions.map((m) => [m.mission.id, m])),
    [prog]
  );
  const nextKey = useMemo(
    () => orderedStepKeys(GTA5_STORY).find((k) => !completed[k]) ?? null,
    [completed]
  );

  const pct = prog.tasksTotal ? Math.round((prog.tasksDone / prog.tasksTotal) * 100) : 0;

  // A completed daily job advances the story by one objective; unchecking retreats it.
  const onToggleJob = (id: string) => {
    if (jobsApi.done[id]) {
      jobsApi.setJobDone(id, false);
      apply((c) => retreatOne(GTA5_STORY, c));
      setLastAdvanced(null);
    } else {
      jobsApi.setJobDone(id, true);
      setLastAdvanced(advanceOne(GTA5_STORY, completed).advancedKey);
      apply((c) => advanceOne(GTA5_STORY, c).completed);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      {/* Global 100%-completion tracker */}
      <header className="rounded-lg border border-line bg-panel px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="display-font text-2xl text-gold leading-none">
              {GTA5_STORY.title}
            </span>
            <span className="hud-label ml-3 text-xs text-muted">Story completion</span>
          </div>
          <div className="hud-label text-xs text-muted">
            <span className="text-white">{prog.missionsDone}</span> / {prog.missionsTotal} missions ·{" "}
            <span className="text-white">{prog.tasksDone}</span> / {prog.tasksTotal} tasks
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="display-font text-lg text-gold tabular-nums">{pct}%</span>
        </div>
      </header>

      <JobsStrip
        jobsApi={jobsApi}
        onToggle={onToggleJob}
        lastAdvanced={lastAdvanced}
        storyComplete={prog.missionsDone === prog.missionsTotal}
      />

      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <StoryMap
          missions={prog.missions}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
        />

        <div className="min-w-0">
          {selected ? (
            <MissionDetail
              mp={selected}
              nextKey={nextKey}
              prevTitle={
                selected.mission.requires.length
                  ? missionById.get(selected.mission.requires[0])?.mission.title
                  : undefined
              }
              completed={completed}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <MissionList
              missions={prog.missions}
              hydrated={hydrated}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Today's jobs (the fuel) ---------- */

function JobsStrip({
  jobsApi,
  onToggle,
  lastAdvanced,
  storyComplete,
}: {
  jobsApi: ReturnType<typeof useDailyJobs>;
  onToggle: (id: string) => void;
  lastAdvanced: string | null;
  storyComplete: boolean;
}) {
  const [draft, setDraft] = useState("");
  const last = lastAdvanced ? describeStep(GTA5_STORY, lastAdvanced) : null;

  return (
    <section className="rounded-lg border border-line bg-panel px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="hud-label text-sm text-white">Today&apos;s jobs</h2>
        <span className="hud-label text-[11px] text-muted">
          Complete a job → advance the story
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {jobsApi.jobs.map((job) => {
          const done = !!jobsApi.done[job.id];
          return (
            <span
              key={job.id}
              className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                done
                  ? "border-gold/60 bg-gold/15 text-gold"
                  : "border-line bg-panel-2 text-white hover:border-muted"
              }`}
            >
              <button
                onClick={() => onToggle(job.id)}
                className="inline-flex items-center gap-2"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    done ? "border-gold bg-gold text-[#0b0e11]" : "border-muted text-transparent"
                  }`}
                >
                  ✓
                </span>
                {job.label}
              </button>
              <button
                onClick={() => jobsApi.removeJob(job.id)}
                aria-label={`Remove ${job.label}`}
                className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              >
                ✕
              </button>
            </span>
          );
        })}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            jobsApi.addJob(draft);
            setDraft("");
          }}
          className="inline-flex items-center gap-1"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a job…"
            className="w-32 rounded-full border border-line bg-panel-2 px-3 py-1.5 text-sm text-white placeholder:text-muted focus:border-muted focus:outline-none"
          />
          <button
            type="submit"
            className="hud-label rounded-full border border-line px-2.5 py-1.5 text-xs text-muted hover:text-white"
          >
            +
          </button>
        </form>
      </div>

      <p className="mt-2 min-h-[16px] text-[11px] text-muted">
        {storyComplete ? (
          <span className="text-gold">Act 1 complete — 100%. Nice work.</span>
        ) : last ? (
          <>
            Last advance: <span className="text-white">“{last.label}”</span> — {last.title}
          </>
        ) : (
          <span className="opacity-70">
            Each job you finish ticks the next objective of your current mission.
          </span>
        )}
      </p>
    </section>
  );
}

/* ---------- Mission list (table beside the map) ---------- */

function StatusChip({ mp }: { mp: MissionProgress }) {
  if (mp.status === "done")
    return <span className="hud-label rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">DONE</span>;
  if (mp.status === "locked")
    return <span className="hud-label rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-muted">LOCKED</span>;
  return (
    <span className="hud-label rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white">
      {mp.stepsDone > 0 ? "IN PROGRESS" : "AVAILABLE"}
    </span>
  );
}

function MissionList({
  missions,
  hydrated,
  onSelect,
  onHover,
  onReset,
}: {
  missions: MissionProgress[];
  hydrated: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex h-[74vh] min-h-[520px] flex-col rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="hud-label text-sm text-white">Missions</h2>
        <span className="hud-label text-[11px] text-muted">Act 1 · click to open</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {missions.map((mp) => {
          const color = PROTAGONIST_COLORS[mp.mission.protagonist];
          const locked = mp.status === "locked";
          return (
            <li key={mp.mission.id}>
              <button
                onClick={() => onSelect(mp.mission.id)}
                onMouseEnter={() => onHover(mp.mission.id)}
                onMouseLeave={() => onHover(null)}
                className={`flex w-full items-center gap-3 border-b border-line/60 px-4 py-2.5 text-left transition-colors hover:bg-panel-2 ${
                  locked ? "opacity-55" : ""
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-[#0b0e11]"
                  style={{ background: mp.status === "done" ? "#e8b71a" : color }}
                >
                  {mp.status === "done" ? "✓" : mp.mission.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm text-white">{mp.mission.title}</span>
                    <StatusChip mp={mp} />
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {PROTAGONIST_NAMES[mp.mission.protagonist]} · {mp.mission.location}
                  </span>
                </span>
                <span className="hud-label shrink-0 text-[11px] text-muted tabular-nums">
                  {mp.stepsDone}/{mp.stepsTotal}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-line px-4 py-2">
        <span className="hud-label text-[10px] text-muted">
          {hydrated ? "Progress saved on this device" : "Loading…"}
        </span>
        <button
          onClick={onReset}
          className="hud-label text-[10px] text-muted underline-offset-2 hover:text-white hover:underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

/* ---------- Mission detail (watch the objectives fill as you work) ---------- */

function MissionDetail({
  mp,
  nextKey,
  prevTitle,
  completed,
  onBack,
}: {
  mp: MissionProgress;
  nextKey: string | null;
  prevTitle?: string;
  completed: Record<string, boolean>;
  onBack: () => void;
}) {
  const m = mp.mission;
  const color = PROTAGONIST_COLORS[m.protagonist];
  const locked = mp.status === "locked";
  const pct = mp.stepsTotal ? Math.round((mp.stepsDone / mp.stepsTotal) * 100) : 0;

  return (
    <div className="flex h-[74vh] min-h-[520px] flex-col rounded-lg border border-line bg-panel">
      <div className="border-b border-line px-4 py-3">
        <button onClick={onBack} className="hud-label mb-2 text-[11px] text-muted hover:text-white">
          ← All missions
        </button>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#0b0e11]"
            style={{ background: mp.status === "done" ? "#e8b71a" : color }}
          >
            {mp.status === "done" ? "✓" : m.order}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight text-white">{m.title}</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              <span style={{ color }}>{PROTAGONIST_NAMES[m.protagonist]}</span>
              {" · "}
              {m.location}
              {m.giver ? ` · giver: ${m.giver}` : ""}
            </p>
          </div>
        </div>
      </div>

      {locked && (
        <div className="border-b border-line bg-panel-2/50 px-4 py-2 text-[12px] text-muted">
          🔒 Locked — finish{" "}
          <span className="text-white">{prevTitle ?? "the previous mission"}</span> first.
        </div>
      )}

      {/* Objectives — filled by completing today's jobs, not clicked */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label text-xs text-white">Objectives</span>
          <span className="hud-label text-[11px] text-muted tabular-nums">
            {mp.stepsDone}/{mp.stepsTotal}
          </span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="flex flex-col gap-1">
          {m.steps.map((step, i) => {
            const key = stepKey(m.id, i);
            const done = !!completed[key];
            const isNext = key === nextKey;
            return (
              <li
                key={i}
                className={`flex items-start gap-2.5 rounded px-2 py-2 text-sm ${
                  isNext ? "bg-gold/10 ring-1 ring-gold/40" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                    done
                      ? "border-gold bg-gold text-[#0b0e11]"
                      : isNext
                        ? "border-gold text-transparent"
                        : "border-line text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={done ? "text-muted line-through" : isNext ? "text-white" : "text-muted"}>
                  {step.label}
                  {isNext && (
                    <span className="hud-label ml-2 text-[10px] text-gold">NEXT</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Story reward */}
      <div className="border-t border-line px-4 py-3">
        <span className="hud-label mb-1.5 block text-[11px] text-gold">Story</span>
        {mp.isDone ? (
          <p className="text-[13px] leading-relaxed text-white/85">{m.summary}</p>
        ) : (
          <p className="rounded border border-dashed border-line bg-panel-2/40 px-3 py-2 text-[12px] text-muted">
            🔒 Complete all {mp.stepsTotal} objectives to unlock this mission&apos;s story.
          </p>
        )}
      </div>
    </div>
  );
}
