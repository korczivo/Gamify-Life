"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "gta5-story-progress-v1";

/**
 * Pilot persistence: completed objectives live in localStorage, keyed by
 * `${missionId}#${stepIndex}`. Swap for a Mongo-backed store later without
 * touching the UI — the shape is a plain `Record<string, true>`.
 */
export function useStoryProgress() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCompleted(JSON.parse(raw));
    } catch {
      // ignore corrupt / unavailable storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(completed));
    } catch {
      // ignore quota / unavailable storage
    }
  }, [completed, hydrated]);

  const toggle = useCallback((key: string) => {
    setCompleted((c) => {
      const next = { ...c };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

  const reset = useCallback(() => setCompleted({}), []);

  /** Apply an arbitrary transform to the completed set (used by advance/retreat). */
  const apply = useCallback(
    (updater: (c: Record<string, boolean>) => Record<string, boolean>) =>
      setCompleted(updater),
    []
  );

  return { completed, toggle, reset, hydrated, apply };
}
