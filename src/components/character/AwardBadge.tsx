import { TIER_COLORS, formatAwardValue, type AwardProgress } from "@/lib/awards";

/** Social Club-style circular award medal with tier ring + progress bar. */
export function AwardBadge({ award }: { award: AwardProgress }) {
  const color = award.tier ? TIER_COLORS[award.tier] : "#3a4149";
  const iconUrl = `/assets/awards/${award.def.id}.svg`;

  return (
    <div className="flex flex-col items-center rounded border border-line bg-panel p-4 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border-[3px]"
        style={{ borderColor: color, backgroundColor: `${color}18` }}
        title={`${award.def.description}: ${formatAwardValue(award.value, award.def.format)}`}
      >
        {/* game-icons silhouette recolored via CSS mask */}
        <div
          className="h-11 w-11"
          style={{
            backgroundColor: color,
            maskImage: `url(${iconUrl})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(${iconUrl})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      </div>
      <div className="mt-2 text-sm font-medium">{award.def.name}</div>
      <div className="hud-label mt-0.5 text-[10px] text-muted">
        {award.def.description}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-panel-2">
        <div
          className="h-full"
          style={{ width: `${Math.round(award.progress * 100)}%`, backgroundColor: color }}
        />
      </div>
      <div className="hud-label mt-1 text-[10px] text-muted">
        {award.nextThreshold === null
          ? `PLATINUM · ${formatAwardValue(award.value, award.def.format)}`
          : `${formatAwardValue(award.value, award.def.format)} / ${formatAwardValue(award.nextThreshold, award.def.format)}`}
      </div>
    </div>
  );
}
