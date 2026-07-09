import type { Metadata } from "next";
import { StoryExplorer } from "@/components/story/StoryExplorer";

export const metadata: Metadata = { title: "Story — EMPIRE" };

export default function StoryPage() {
  return <StoryExplorer />;
}
