import type { Metadata } from "next";
import { WeekBoard } from "@/components/plan/WeekBoard";

export const metadata: Metadata = { title: "Plan — EMPIRE" };

export default function PlanPage() {
  return <WeekBoard />;
}
