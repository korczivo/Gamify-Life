"use client";

import { useState } from "react";
import { CharacterWizard } from "./CharacterWizard";
import { PLASTIC_SURGERY_COST } from "@/lib/economy";

export function SurgeryPanel({
  currentName,
  currentPortraitId,
}: {
  currentName: string;
  currentPortraitId: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hud-label rounded border border-line px-3 py-1.5 text-[11px] text-muted hover:text-white hover:bg-panel-2"
        title="New face, new name"
      >
        💉 Plastic surgery · ${PLASTIC_SURGERY_COST.toLocaleString("en-US")}
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto">
        <CharacterWizard
          mode="surgery"
          currentName={currentName}
          currentPortraitId={currentPortraitId}
          onClose={() => setOpen(false)}
        />
      </div>
    </div>
  );
}
