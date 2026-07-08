/** Social Club-style "Cash Earned" donut with a per-source breakdown. */

const COLORS = ["#e8b71a", "#9dfb53", "#54c7fc", "#d68cff"];

export interface CashSource {
  label: string;
  value: number;
}

export function CashDonut({ sources }: { sources: CashSource[] }) {
  const total = sources.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return (
      <div className="hud-label py-6 text-center text-xs text-muted">
        Earn some cash first.
      </div>
    );
  }
  const sorted = [...sources].sort((a, b) => b.value - a.value);
  const top = sorted[0];

  // Donut geometry: stroke-dasharray segments on a circle.
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segments = sorted
    .filter((s) => s.value > 0)
    .map((s, i) => {
      const frac = s.value / total;
      const seg = {
        color: COLORS[i % COLORS.length],
        dash: `${Math.max(0, frac * C - 3)} ${C}`,
        offset: -offset * C,
        label: s.label,
      };
      offset += frac;
      return seg;
    });

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="#1b2026" strokeWidth="14" />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={seg.dash}
              strokeDashoffset={seg.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="display-font text-xl text-white">
            {Math.round((top.value / total) * 100)}%
          </span>
          <span className="hud-label text-[9px] text-muted">{top.label}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((s, i) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: s.value > 0 ? COLORS[i % COLORS.length] : "#2a3038" }}
            />
            <span className="hud-label w-24 text-[11px] text-muted">{s.label}</span>
            <span className="display-font text-sm text-white/90">
              ${s.value.toLocaleString("en-US")}
            </span>
          </div>
        ))}
        <div className="mt-1 border-t border-line pt-2">
          <span className="hud-label text-[11px] text-muted">Total earned </span>
          <span className="display-font text-sm text-cash">
            ${total.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </div>
  );
}
