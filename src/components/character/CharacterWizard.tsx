"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCharacterAction, plasticSurgeryAction } from "@/actions/character";
import { useCelebration } from "@/components/hud/Celebrations";
import { PLASTIC_SURGERY_COST, PORTRAIT_IDS } from "@/lib/economy";

/**
 * GTA-style character creation. First run is free; later visits are
 * "plastic surgery" and cost real money.
 */
export function CharacterWizard({
  mode,
  currentName,
  currentPortraitId,
  onClose,
}: {
  mode: "create" | "surgery";
  currentName?: string;
  currentPortraitId?: string;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const celebrate = useCelebration();
  const [name, setName] = useState(currentName ?? "");
  const [portraitId, setPortraitId] = useState(currentPortraitId ?? "");

  const submit = () =>
    startTransition(async () => {
      const action = mode === "create" ? createCharacterAction : plasticSurgeryAction;
      const r = await action(name, portraitId);
      if (!r.ok) {
        celebrate({ error: r.error });
        return;
      }
      if (r.cashDelta) celebrate({ cashDelta: r.cashDelta });
      onClose?.();
      router.refresh();
    });

  return (
    <div className="rounded border border-line bg-panel p-6">
      <div className="display-font text-3xl text-gold">
        {mode === "create" ? "Welcome to Los Santos" : "Plastic surgery"}
      </div>
      <p className="hud-label mt-1 text-xs text-muted">
        {mode === "create"
          ? "Every empire starts with a face and a name. Pick yours."
          : `A new face and a new name — $${PLASTIC_SURGERY_COST.toLocaleString("en-US")}, no questions asked.`}
      </p>

      <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-4 md:grid-cols-8">
        {PORTRAIT_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setPortraitId(id)}
            className={`relative aspect-3/4 overflow-hidden rounded border-2 transition-all ${
              portraitId === id
                ? "border-gold shadow-[0_0_16px_rgba(232,183,26,0.4)]"
                : "border-line opacity-60 hover:opacity-100"
            }`}
          >
            <Image
              src={`/assets/portraits/${id}.jpg`}
              alt={id}
              fill
              className="object-cover object-top"
              sizes="140px"
            />
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-col gap-1">
          <span className="hud-label text-xs text-muted">Character name</span>
          <input
            className="rounded border border-line bg-panel-2 px-3 py-2 text-sm outline-none focus:border-gold/60"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Founder"
            maxLength={24}
          />
        </label>
        <button
          onClick={submit}
          disabled={pending || !name.trim() || !portraitId}
          className="hud-label rounded border border-gold/50 bg-gold/10 px-6 py-2.5 text-sm font-bold text-gold hover:bg-gold/20 disabled:opacity-40"
        >
          {mode === "create"
            ? "Start your story"
            : `Go under the knife · $${PLASTIC_SURGERY_COST.toLocaleString("en-US")}`}
        </button>
        {mode === "surgery" && (
          <button
            onClick={onClose}
            className="hud-label px-2 py-2.5 text-xs text-muted hover:text-white"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
