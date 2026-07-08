"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startHeistAction } from "@/actions/heists";
import { HEIST_TIERS, HEIST_BUYIN_PCT, type HeistTier } from "@/lib/economy";

const inputCls =
  "rounded border border-line bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-gold/60";

interface PrepRow {
  name: string;
  kind: "mandatory" | "optional";
}

export function HeistCreator({
  ownedAssetIds,
  disabled,
}: {
  ownedAssetIds: string[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tier, setTier] = useState<HeistTier>("small");
  const [finaleName, setFinaleName] = useState("");
  const [preps, setPreps] = useState<PrepRow[]>([
    { name: "", kind: "mandatory" },
    { name: "", kind: "mandatory" },
  ]);

  const owned = new Set(ownedAssetIds);
  const tierEntries = Object.entries(HEIST_TIERS) as [
    HeistTier,
    (typeof HEIST_TIERS)[HeistTier],
  ][];

  const submit = () => {
    const cleanPreps = preps.filter((p) => p.name.trim());
    if (!name.trim() || cleanPreps.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await startHeistAction({
        name: name.trim(),
        tier,
        finaleName: finaleName.trim() || "THE FINALE",
        preps: cleanPreps,
      });
      if (r.ok && r.heistId) router.push(`/heists/${r.heistId}`);
      else setError(r.error ?? "Could not start the heist");
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
        <div className="flex flex-wrap items-end gap-3">
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
            <select
              className={inputCls}
              value={tier}
              onChange={(e) => setTier(e.target.value as HeistTier)}
            >
              {tierEntries.map(([key, t]) => {
                const locked = t.requiresAssetId && !owned.has(t.requiresAssetId);
                return (
                  <option key={key} value={key} disabled={Boolean(locked)}>
                    {t.label} · ${t.basePayout.toLocaleString("en-US")}
                    {locked ? " 🔒" : ""}
                  </option>
                );
              })}
            </select>
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
            Preps — mandatory gate the finale, optional pay +10% each
          </span>
          <div className="mt-2 flex flex-col gap-2">
            {preps.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={p.name}
                  onChange={(e) =>
                    setPreps((rows) =>
                      rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r))
                    )
                  }
                  placeholder={`Prep ${i + 1} — e.g. Write the script`}
                />
                <button
                  onClick={() =>
                    setPreps((rows) =>
                      rows.map((r, j) =>
                        j === i
                          ? { ...r, kind: r.kind === "mandatory" ? "optional" : "mandatory" }
                          : r
                      )
                    )
                  }
                  className={`hud-label w-28 rounded px-2 py-1.5 text-xs ${
                    p.kind === "mandatory"
                      ? "bg-danger/15 text-danger"
                      : "bg-gold/15 text-gold"
                  }`}
                >
                  {p.kind}
                </button>
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
          <button
            onClick={() => setPreps((rows) => [...rows, { name: "", kind: "optional" }])}
            className="hud-label mt-2 text-xs text-muted hover:text-white"
          >
            + Add prep
          </button>
        </div>

        {error && <p className="hud-label mt-3 text-xs text-danger">{error}</p>}

        <button
          onClick={submit}
          disabled={pending || !name.trim() || preps.every((p) => !p.name.trim())}
          className="hud-label mt-4 w-full rounded border border-gold/50 bg-gold/10 py-2.5 text-sm font-bold text-gold hover:bg-gold/20 disabled:opacity-40"
        >
          Start the heist — buy-in ${buyIn.toLocaleString("en-US")}
        </button>
      </div>
    </div>
  );
}
