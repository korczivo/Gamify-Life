"use client";

import { useEffect, useRef, useState } from "react";

/** GTA-style cash odometer: counts up/down toward the server value. */
export function CashCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef(value);
  const raf = useRef(0);

  useEffect(() => {
    const from = prev.current;
    if (from === value) return;
    prev.current = value;
    setFlash(value > from ? "up" : "down");
    const started = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else setTimeout(() => setFlash(null), 400);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <div
      className={`display-font text-2xl leading-none transition-colors duration-300 ${
        flash === "up"
          ? "text-white drop-shadow-[0_0_10px_rgba(157,251,83,0.9)]"
          : flash === "down"
            ? "text-danger"
            : "text-cash"
      }`}
    >
      ${display.toLocaleString("en-US")}
    </div>
  );
}
