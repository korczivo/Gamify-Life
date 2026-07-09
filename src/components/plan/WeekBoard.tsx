"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_META,
  DAYS,
  computeContract,
  type PlanBlock,
  type PlanCategory,
} from "@/lib/plan/schedule";
import { fmtRange, usePlanner, type Goal } from "@/lib/plan/usePlanner";

type EditorState =
  | { mode: "new"; draft: PlanBlock }
  | { mode: "edit"; draft: PlanBlock }
  | null;

const newId = () => "b-" + Math.random().toString(36).slice(2, 9);

export function WeekBoard() {
  const p = usePlanner();
  const [editor, setEditor] = useState<EditorState>(null);

  const contract = useMemo(
    () => computeContract(p.visibleBlocks, p.week.done, p.targets),
    [p.visibleBlocks, p.week.done, p.targets]
  );

  const byDay = useMemo(() => {
    const m: PlanBlock[][] = [[], [], [], [], [], [], []];
    for (const b of p.visibleBlocks) m[b.day]?.push(b);
    return m;
  }, [p.visibleBlocks]);

  const openNew = (day: number) =>
    setEditor({
      mode: "new",
      draft: { id: newId(), day, title: "", category: "dev" },
    });

  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
      <GoalsBar p={p} />

      {/* Week nav + contract */}
      <section className="rounded-lg border border-line bg-panel px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => p.setOffset(p.offset - 1)}
              className="hud-label rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
            >
              ‹
            </button>
            <span className="display-font text-xl text-gold">{fmtRange(p.monday)}</span>
            {p.isThisWeek ? (
              <span className="hud-label rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">
                THIS WEEK
              </span>
            ) : (
              <button
                onClick={() => p.setOffset(0)}
                className="hud-label text-[10px] text-muted underline-offset-2 hover:text-white hover:underline"
              >
                today
              </button>
            )}
            <button
              onClick={() => p.setOffset(p.offset + 1)}
              className="hud-label rounded border border-line px-2 py-1 text-xs text-muted hover:text-white"
            >
              ›
            </button>
            {p.hasPrevWeek && (
              <button
                onClick={p.copyLastWeek}
                className="hud-label ml-1 rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-white"
              >
                Copy last week
              </button>
            )}
            {p.visibleBlocks.length > 0 && (
              <button
                onClick={p.clearWeek}
                className="hud-label rounded border border-line px-2 py-1 text-[10px] text-muted hover:text-danger"
              >
                Clear week
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {contract.map((c) => (
              <ContractMeter key={c.category} c={c} onSetTarget={(n) => p.setTarget(c.category, n)} />
            ))}
          </div>
        </div>

        <ColumnBoard
          byDay={byDay}
          monday={p.monday}
          todayIdx={todayIdx}
          done={p.week.done}
          onOpen={(b) => setEditor({ mode: "edit", draft: b })}
          onNew={openNew}
          onToggle={p.toggleDone}
        />
      </section>

      {editor && (
        <BlockEditor
          state={editor}
          goals={p.goals}
          onClose={() => setEditor(null)}
          onSave={(block) => {
            if (editor.mode === "new") p.addBlock(block);
            else p.updateBlock(block);
            setEditor(null);
          }}
          onDelete={(id) => {
            p.removeBlock(id);
            setEditor(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Goals (cross-week, cumulative) ---------- */

function GoalsBar({ p }: { p: ReturnType<typeof usePlanner> }) {
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  return (
    <section className="rounded-lg border border-line bg-panel px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="hud-label text-sm text-white">Goals</h2>
        <span className="hud-label text-[11px] text-muted">Cumulative · across weeks</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {p.goals.map((g) => {
          const cur = p.goalCurrent[g.id] ?? 0;
          const pct = g.target ? Math.min(100, Math.round((cur / g.target) * 100)) : 0;
          const hit = cur >= g.target && g.target > 0;
          return (
            <div key={g.id} className="group rounded border border-line bg-panel-2 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm text-white">
                  {g.emoji} {g.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => p.bumpGoal(g.id, -1)}
                    className="h-5 w-5 rounded bg-panel text-muted hover:text-white"
                  >
                    −
                  </button>
                  <span className={`tabular-nums text-xs ${hit ? "text-gold" : "text-white"}`}>
                    {cur}/{g.target}
                  </span>
                  <button
                    onClick={() => p.bumpGoal(g.id, 1)}
                    className="h-5 w-5 rounded bg-panel text-muted hover:text-white"
                  >
                    +
                  </button>
                  <button
                    onClick={() => p.removeGoal(g.id)}
                    className="ml-1 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel">
                <div
                  className={`h-full rounded-full transition-all ${hit ? "bg-gold" : "bg-rp"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = parseInt(target, 10);
            if (label.trim() && t > 0) {
              p.addGoal(label.trim(), t, "🎯");
              setLabel("");
              setTarget("");
            }
          }}
          className="flex items-center gap-1.5 rounded border border-dashed border-line px-3 py-2"
        >
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="New goal…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
          />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="30"
            inputMode="numeric"
            className="w-12 rounded bg-panel-2 px-2 py-1 text-sm text-white placeholder:text-muted focus:outline-none"
          />
          <button type="submit" className="hud-label rounded border border-line px-2 py-1 text-xs text-muted hover:text-white">
            +
          </button>
        </form>
      </div>
    </section>
  );
}

function ContractMeter({
  c,
  onSetTarget,
}: {
  c: ReturnType<typeof computeContract>[number];
  onSetTarget: (n: number) => void;
}) {
  const meta = CATEGORY_META[c.category];
  const pct = c.target ? Math.min(100, Math.round((c.done / c.target) * 100)) : 0;
  const plannedPct = c.target ? Math.min(100, (c.planned / c.target) * 100) : 0;
  return (
    <div className="w-36">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="hud-label" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="tabular-nums text-muted">
          <span className="text-white">{c.done}</span>/
          <input
            value={c.target}
            onChange={(e) => onSetTarget(parseInt(e.target.value, 10) || 0)}
            inputMode="numeric"
            className="w-6 bg-transparent text-right text-white focus:outline-none"
          />
        </span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-30"
          style={{ width: `${plannedPct}%`, background: meta.color }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: meta.color }}
        />
      </div>
    </div>
  );
}

/* ---------- Week board: 7 day buckets ---------- */

function ColumnBoard({
  byDay,
  monday,
  todayIdx,
  done,
  onOpen,
  onNew,
  onToggle,
}: {
  byDay: PlanBlock[][];
  monday: Date;
  todayIdx: number;
  done: Record<string, boolean>;
  onOpen: (b: PlanBlock) => void;
  onNew: (day: number) => void;
  onToggle: (id: string) => void;
}) {
  const dayNum = (day: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + day);
    return d.getDate();
  };

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-7 gap-2">
        {byDay.map((items, day) => (
          <div
            key={day}
            className={`flex min-h-[320px] flex-col rounded-lg border bg-panel-2/40 ${
              day === todayIdx ? "border-gold/40" : "border-line"
            }`}
          >
            <div
              className={`flex items-baseline justify-center gap-1.5 border-b px-2 py-1.5 ${
                day === todayIdx ? "border-gold/40" : "border-line"
              }`}
            >
              <span className={`hud-label text-xs ${day === todayIdx ? "text-gold" : "text-muted"}`}>
                {DAYS[day]}
              </span>
              <span className={`text-xs tabular-nums ${day === todayIdx ? "text-gold" : "text-muted/70"}`}>
                {dayNum(day)}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1.5 p-1.5">
              {items.map((b) => {
                const meta = CATEGORY_META[b.category];
                const isDone = !!done[b.id];
                return (
                  <div
                    key={b.id}
                    className="flex items-start gap-1.5 rounded bg-panel px-1.5 py-1.5"
                    style={{ borderLeft: `3px solid ${meta.color}`, opacity: isDone ? 0.5 : 1 }}
                  >
                    <button
                      onClick={() => onToggle(b.id)}
                      aria-label="Toggle done"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        isDone
                          ? "border-gold bg-gold text-[#0b0e11]"
                          : "border-muted text-transparent hover:border-white"
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onOpen(b)}
                      className={`min-w-0 flex-1 text-left text-[12px] leading-snug ${
                        isDone ? "text-muted line-through" : "text-white"
                      }`}
                    >
                      {b.title}
                    </button>
                  </div>
                );
              })}

              <button
                onClick={() => onNew(day)}
                className="mt-auto rounded border border-dashed border-line py-1 text-[11px] text-muted hover:border-muted hover:text-white"
              >
                + add
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Each week is its own plan · add things per day · check to mark done · click a task to edit.
      </p>
    </div>
  );
}

/* ---------- Task editor ---------- */

function BlockEditor({
  state,
  goals,
  onClose,
  onSave,
  onDelete,
}: {
  state: NonNullable<EditorState>;
  goals: Goal[];
  onClose: () => void;
  onSave: (b: PlanBlock) => void;
  onDelete: (id: string) => void;
}) {
  const [b, setB] = useState<PlanBlock>(state.draft);
  const set = (patch: Partial<PlanBlock>) => setB((x) => ({ ...x, ...patch }));

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-line bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="hud-label mb-3 text-sm text-white">
          {state.mode === "new" ? "New task" : "Edit task"}
        </h3>

        <label className="mb-1 block text-[11px] text-muted">Title</label>
        <input
          autoFocus
          value={b.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && b.title.trim()) onSave({ ...b, title: b.title.trim() });
          }}
          placeholder="e.g. Coding, Cold DMs, Walk…"
          className="mb-3 w-full rounded border border-line bg-panel-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-muted focus:outline-none"
        />

        <label className="mb-1 block text-[11px] text-muted">Track</label>
        <div className="mb-3 flex gap-1.5">
          {(Object.keys(CATEGORY_META) as PlanCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => set({ category: cat })}
              className="flex-1 rounded border px-2 py-1.5 text-xs"
              style={{
                borderColor: b.category === cat ? CATEGORY_META[cat].color : "#2a3038",
                background: b.category === cat ? CATEGORY_META[cat].color + "22" : "transparent",
                color: b.category === cat ? CATEGORY_META[cat].color : "#8b949e",
              }}
            >
              {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-muted">Day</label>
            <select
              value={b.day}
              onChange={(e) => set({ day: Number(e.target.value) })}
              className="w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Goal link</label>
            <select
              value={b.goalId ?? ""}
              onChange={(e) => set({ goalId: e.target.value || undefined })}
              className="w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-sm text-white focus:outline-none"
            >
              <option value="">None</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {state.mode === "edit" ? (
            <button
              onClick={() => onDelete(b.id)}
              className="hud-label rounded border border-line px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="hud-label rounded px-2.5 py-1.5 text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => b.title.trim() && onSave({ ...b, title: b.title.trim() })}
              className="hud-label rounded bg-gold px-3 py-1.5 text-xs text-[#0b0e11]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
