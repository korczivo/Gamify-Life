"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startHeistAction } from "@/actions/heists";
import {
  HEIST_TEMPLATES,
  HEIST_TIERS,
  HEIST_BUYIN_PCT,
  LOOT_TABLE,
  LOOT_TABLE_CAYO,
  formatMinutes,
  heistMandatoryMinutes,
  type HeistTemplateDef,
  type HeistTier,
  type PrepRequirement,
} from "@/lib/economy";

const inputCls =
  "rounded border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/60";

interface PrepRow {
  name: string;
  kind: "mandatory" | "optional";
  flavor?: string;
  /** Always "deepwork" now — heists are a pure time gate. */
  requirement: PrepRequirement;
  /** Deep-work minutes this block demands. */
  target: number;
}

const blankPrep = (kind: "mandatory" | "optional"): PrepRow => ({
  name: "",
  kind,
  requirement: "deepwork",
  target: 45,
});

export function HeistCreator({
  ownedAssetIds,
  templateArt,
  disabled,
}: {
  ownedAssetIds: string[];
  templateArt: Record<string, string | null>;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rollDisplay, setRollDisplay] = useState<string | null>(null);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<HeistTier>("small");
  const [finaleName, setFinaleName] = useState("");
  const [preps, setPreps] = useState<PrepRow[]>([
    blankPrep("mandatory"),
    blankPrep("mandatory"),
  ]);

  const owned = new Set(ownedAssetIds);
  const tierEntries = Object.entries(HEIST_TIERS) as [
    HeistTier,
    (typeof HEIST_TIERS)[HeistTier],
  ][];
  const tierLocked = (t: HeistTier) => {
    const req = HEIST_TIERS[t].requiresAssetId;
    return Boolean(req && !owned.has(req));
  };

  const selectTemplate = (t: HeistTemplateDef) => {
    setTemplateId(t.id);
    setName(t.name);
    setTier(t.tier);
    setFinaleName(t.finaleName);
    setPreps(
      t.preps.map((p) => ({
        name: p.task,
        kind: p.kind,
        flavor: p.flavor,
        requirement: "deepwork",
        target: p.minutes,
      }))
    );
    setError(null);
  };

  const selectCustom = () => {
    setTemplateId(null);
    setName("");
    setTier("small");
    setFinaleName("");
    setPreps([blankPrep("mandatory"), blankPrep("mandatory")]);
    setError(null);
  };

  const submit = () => {
    const cleanPreps = preps.filter((p) => p.name.trim());
    if (!name.trim() || cleanPreps.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await startHeistAction({
        name: name.trim(),
        templateId: templateId ?? undefined,
        tier,
        finaleName: finaleName.trim() || "THE FINALE",
        preps: cleanPreps.map((p) => ({
          name: p.name.trim(),
          kind: p.kind,
          flavor: p.flavor,
          requirement: p.requirement,
          target: Math.max(1, Math.round(p.target)),
        })),
      });
      if (r.ok && r.heistId) {
        // Loot roulette: cycle the table, land on the actual roll, then
        // open the planning board.
        const table = tier === "cayo" ? LOOT_TABLE_CAYO : LOOT_TABLE;
        const kinds = table.map((l) => l.kind);
        const lootKind = r.loot?.kind ?? kinds[0];
        let i = 0;
        const spins = 14 + kinds.indexOf(lootKind);
        const interval = setInterval(() => {
          setRollDisplay(kinds[i % kinds.length]);
          i++;
          if (i > spins) {
            clearInterval(interval);
            setRollDisplay(lootKind);
            setTimeout(() => router.push(`/heists/${r.heistId}`), 900);
          }
        }, 110);
      } else setError(r.error ?? "Could not start the heist");
    });
  };

  const buyIn = Math.round(HEIST_TIERS[tier].basePayout * HEIST_BUYIN_PCT);

  return (
    <div className="rounded border border-line bg-panel p-4">
      <h2 className="hud-label mb-3 text-sm text-white">Plan a new score</h2>
      {disabled && (
        <p className="hud-label mb-3 text-xs text-gold">
          Finish or archive your current heist before planning another.
        </p>
      )}
      <div className={disabled ? "pointer-events-none opacity-40" : ""}>
        {/* template picker */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {HEIST_TEMPLATES.map((t) => {
            const locked = tierLocked(t.tier);
            const art = templateArt[t.id];
            const selected = templateId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => selectTemplate(t)}
                disabled={locked}
                className={`overflow-hidden rounded border text-left transition-all ${
                  selected
                    ? "border-gold bg-gold/10"
                    : "border-line bg-panel-2 hover:border-gold/40"
                } ${locked ? "opacity-40" : ""}`}
              >
                <div className="relative h-24 bg-black/50">
                  {art && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={art}
                      alt={t.name}
                      className="h-full w-full object-cover object-top"
                    />
                  )}
                  <span className="hud-label absolute right-1.5 top-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] text-gold">
                    {locked ? "🔒 " : ""}
                    {HEIST_TIERS[t.tier].label}
                  </span>
                </div>
                <div className="p-2.5">
                  <div className="display-font text-lg leading-tight text-white/90">
                    {t.name}
                  </div>
                  <div className="hud-label mt-1 text-[11px] leading-snug text-muted">
                    {t.tagline}
                  </div>
                  <div className="hud-label mt-1.5 text-[10px] text-gold/80">
                    ${HEIST_TIERS[t.tier].basePayout.toLocaleString("en-US")} · buy-in $
                    {Math.round(
                      HEIST_TIERS[t.tier].basePayout * HEIST_BUYIN_PCT
                    ).toLocaleString("en-US")}{" "}
                    · {formatMinutes(heistMandatoryMinutes(t.preps))} deep work
                  </div>
                </div>
              </button>
            );
          })}
          <button
            onClick={selectCustom}
            className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded border border-dashed p-2.5 transition-all ${
              templateId === null
                ? "border-gold bg-gold/10"
                : "border-line bg-panel-2 hover:border-gold/40"
            }`}
          >
            <span className="display-font text-lg text-white/90">Custom Score</span>
            <span className="hud-label text-[11px] text-muted">
              Plan your own job from scratch
            </span>
          </button>
        </div>

        {/* plan form */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="hud-label text-xs text-muted">Heist name (the big goal)</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Launch YouTube video"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hud-label text-xs text-muted">Tier</span>
            {templateId ? (
              <span className="rounded border border-line bg-panel-2 px-2.5 py-1.5 text-sm text-white/80">
                {HEIST_TIERS[tier].label} · ${HEIST_TIERS[tier].basePayout.toLocaleString("en-US")}
              </span>
            ) : (
              <select
                className={inputCls}
                value={tier}
                onChange={(e) => setTier(e.target.value as HeistTier)}
              >
                {tierEntries.map(([key, t]) => (
                  <option key={key} value={key} disabled={tierLocked(key)}>
                    {t.label} · ${t.basePayout.toLocaleString("en-US")}
                    {tierLocked(key) ? " 🔒" : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="flex min-w-44 flex-col gap-1">
            <span className="hud-label text-xs text-muted">Finale (the payoff moment)</span>
            <input
              className={inputCls}
              value={finaleName}
              onChange={(e) => setFinaleName(e.target.value)}
              placeholder="e.g. PUBLISH"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="hud-label text-xs text-muted">
            Each prep is a deep-work block (minutes). On the board you hit Start
            and sit through its timer — every prep is required to reach the finale.
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {preps.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {p.flavor && (
                  <span className="hud-label w-36 shrink-0 truncate rounded-sm bg-black/40 px-2 py-1.5 text-right text-[11px] text-gold/90">
                    {p.flavor}
                  </span>
                )}
                <input
                  className={`${inputCls} flex-1`}
                  value={p.name}
                  onChange={(e) =>
                    setPreps((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                    )
                  }
                  placeholder={`Prep ${i + 1} — e.g. Script writing`}
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    className={`${inputCls} w-20 text-center`}
                    value={p.target}
                    onChange={(e) =>
                      setPreps((rows) =>
                        rows.map((r, j) =>
                          j === i ? { ...r, target: Number(e.target.value) || 5 } : r
                        )
                      )
                    }
                  />
                  <span className="hud-label text-[11px] text-muted">min</span>
                </div>
                <button
                  onClick={() => setPreps((rows) => rows.filter((_, j) => j !== i))}
                  className="text-muted hover:text-danger"
                  disabled={preps.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={() => setPreps((rows) => [...rows, blankPrep("mandatory")])}
              className="hud-label text-xs text-muted hover:text-white"
            >
              + Add prep
            </button>
            <span className="hud-label text-xs text-muted">
              {formatMinutes(heistMandatoryMinutes(preps))} of deep work to the finale
            </span>
          </div>
        </div>

        {error && <p className="hud-label mt-3 text-xs text-danger">{error}</p>}

        {rollDisplay ? (
          <div className="mt-4 rounded border border-gold/50 bg-black/40 py-3 text-center">
            <div className="hud-label text-xs text-muted">
              Scoping the target — what&apos;s in the vault?
            </div>
            <div className="display-font mt-1 text-3xl text-gold">{rollDisplay}</div>
          </div>
        ) : (
          <button
            onClick={submit}
            disabled={pending || !name.trim() || preps.every((p) => !p.name.trim())}
            className="hud-label mt-4 w-full rounded border border-gold/50 bg-gold/10 py-2.5 text-sm font-bold text-gold hover:bg-gold/20 disabled:opacity-40"
          >
            Start the heist — buy-in ${buyIn.toLocaleString("en-US")}
          </button>
        )}
      </div>
    </div>
  );
}
