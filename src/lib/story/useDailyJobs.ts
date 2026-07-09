"use client";

import { useCallback, useEffect, useState } from "react";

export interface DailyJob {
  id: string;
  label: string;
}

const JOBS_KEY = "gta5-daily-jobs-v1";
const DONE_KEY = "gta5-daily-done-v1"; // { date, done: Record<id, true> }

/** Seeded from the user's real recurring work. Editable. */
const DEFAULT_JOBS: DailyJob[] = [
  { id: "j-colddm", label: "Cold DMs / outreach" },
  { id: "j-reddit", label: "Reddit / SEO post" },
  { id: "j-youtube", label: "YouTube video" },
  { id: "j-deepwork", label: "Deep-work session (45m)" },
];

const today = () => new Date().toDateString();

/**
 * The pilot's fuel source: a small list of the user's real daily jobs. Checking
 * one is what advances the story. Checks reset each new day (so you keep grinding),
 * but a new day does NOT retreat the story — yesterday's advances are committed.
 */
export function useDailyJobs() {
  const [jobs, setJobs] = useState<DailyJob[]>(DEFAULT_JOBS);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawJobs = localStorage.getItem(JOBS_KEY);
      if (rawJobs) setJobs(JSON.parse(rawJobs));
      const rawDone = localStorage.getItem(DONE_KEY);
      if (rawDone) {
        const parsed = JSON.parse(rawDone);
        // Only restore today's checks; a new day starts blank (advances stay committed).
        if (parsed?.date === today()) setDone(parsed.done ?? {});
      }
    } catch {
      // ignore corrupt / unavailable storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
    } catch {
      /* ignore */
    }
  }, [jobs, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify({ date: today(), done }));
    } catch {
      /* ignore */
    }
  }, [done, hydrated]);

  const setJobDone = useCallback((id: string, value: boolean) => {
    setDone((d) => {
      const next = { ...d };
      if (value) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  const addJob = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = "j-" + Math.random().toString(36).slice(2, 9);
    setJobs((j) => [...j, { id, label: trimmed }]);
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((j) => j.filter((x) => x.id !== id));
    setDone((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
  }, []);

  return { jobs, done, hydrated, setJobDone, addJob, removeJob };
}
