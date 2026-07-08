import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { serialize } from "@/lib/game";
import { Heist } from "@/lib/models/Heist";
import type { SerializedHeist } from "@/lib/types";
import { HeistBoard } from "@/components/heists/HeistBoard";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return { title: "Heist — EMPIRE" };
  await dbConnect();
  const heist = await Heist.findById(id).select({ name: 1 }).lean();
  return { title: heist ? `${heist.name} — EMPIRE` : "Heist — EMPIRE" };
}

export default async function HeistBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();
  await dbConnect();
  const heist = await Heist.findById(id).lean();
  if (!heist) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <HeistBoard heist={serialize<SerializedHeist>(heist)} />
    </div>
  );
}
