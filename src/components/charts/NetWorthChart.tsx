"use client";

import { useMemo, useRef, useState } from "react";
import type { NetWorthSeries } from "@/lib/networth";

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Stripe-style net-worth chart: hero number, delta, gridlines, crosshair tooltip. */
export function NetWorthChart({
  series: { points: series, caption },
  height = 180,
  compactMode = false,
}: {
  series: NetWorthSeries;
  height?: number;
  compactMode?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const width = 600; // viewBox units; scales to container
  const padTop = 8;
  const padBottom = 18;

  const geom = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);
    // Pad the domain so the line doesn't hug the edges.
    const lo = Math.max(0, min - span * 0.08);
    const hi = max + span * 0.08;
    const x = (i: number) => (i / (series.length - 1)) * width;
    const y = (v: number) =>
      padTop + (1 - (v - lo) / Math.max(1, hi - lo)) * (height - padTop - padBottom);
    const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    // ~3 horizontal gridlines at round-ish values
    const gridCount = 3;
    const grid = Array.from({ length: gridCount }, (_, k) => {
      const v = lo + ((k + 1) / (gridCount + 1)) * (hi - lo);
      return { v, y: y(v) };
    });
    return { x, y, pts, grid, lo, hi };
  }, [series, height]);

  if (!geom || series.length < 2) {
    return (
      <div className="hud-label py-6 text-center text-xs text-muted">
        Complete missions to start the curve.
      </div>
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const delta = last.value - first.value;
  const deltaPct = first.value > 0 ? (delta / first.value) * 100 : null;
  const hovered = hover !== null ? series[hover] : null;
  const prevOfHovered = hover !== null && hover > 0 ? series[hover - 1] : null;
  const dayDelta = hovered && prevOfHovered ? hovered.value - prevOfHovered.value : null;

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.round(frac * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  const path = `M${geom.pts.join(" L")}`;
  // Dedupe: with 2-3 points first/mid/last indexes collide.
  const xLabels = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];

  return (
    <div>
      {/* hero number + delta */}
      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className={`display-font text-cash ${compactMode ? "text-2xl" : "text-4xl"}`}>
          ${(hovered ?? last).value.toLocaleString("en-US")}
        </span>
        <span
          className={`hud-label text-xs font-bold ${delta >= 0 ? "text-cash" : "text-danger"}`}
        >
          {delta >= 0 ? "▲" : "▼"} {compact(Math.abs(delta))}
          {deltaPct !== null && ` (${delta >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`}
        </span>
        <span className="hud-label text-[11px] text-muted">
          {hovered
            ? `${hovered.label}${dayDelta !== null ? ` · ${dayDelta >= 0 ? "+" : "−"}${compact(Math.abs(dayDelta)).slice(1)}` : ""}`
            : caption}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative mt-2 cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label="Net worth over time"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9dfb53" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#9dfb53" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* recessive gridlines */}
          {geom.grid.map((g) => (
            <line
              key={g.y}
              x1="0"
              x2={width}
              y1={g.y}
              y2={g.y}
              stroke="#2a3038"
              strokeWidth="1"
              strokeDasharray="3 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path
            d={`${path} L${width},${height - padBottom} L0,${height - padBottom} Z`}
            fill="url(#nw-fill)"
          />
          <path
            d={path}
            fill="none"
            stroke="#9dfb53"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* crosshair */}
          {hover !== null && (
            <>
              <line
                x1={geom.x(hover)}
                x2={geom.x(hover)}
                y1={padTop}
                y2={height - padBottom}
                stroke="#8b949e"
                strokeWidth="1"
                strokeDasharray="2 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={geom.x(hover)}
                cy={geom.y(series[hover].value)}
                r="4"
                fill="#9dfb53"
                stroke="#0b0e11"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {/* y gridline labels */}
        {!compactMode &&
          geom.grid.map((g) => (
            <span
              key={g.y}
              className="hud-label absolute left-1 text-[10px] text-muted"
              style={{ top: `${(g.y / height) * 100}%`, transform: "translateY(-110%)" }}
            >
              {compact(g.v)}
            </span>
          ))}

        {/* x date labels */}
        <div className="hud-label absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-muted">
          {xLabels.map((i) => (
            <span key={i}>{series[i].label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
