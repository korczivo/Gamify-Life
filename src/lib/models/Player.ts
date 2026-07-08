import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    _id: { type: String, default: "player" },
    cash: { type: Number, default: 0 },
    totalRp: { type: Number, default: 0 },
    rank: { type: Number, default: 1 },
    residualPerDay: { type: Number, default: 0 },
    safeBalance: { type: Number, default: 0 },
    safeLastCreditedDayKey: { type: String, default: "" },
    pinnedGoalAssetId: { type: String, default: null },
    characterName: { type: String, default: null },
    portraitId: { type: String, default: null },
    /** Skill XP — grows only from work, never purchases. */
    skills: {
      marketing: { type: Number, default: 0 },
      dev: { type: Number, default: 0 },
      content: { type: Number, default: 0 },
      admin: { type: Number, default: 0 },
      focus: { type: Number, default: 0 },
      reputation: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type PlayerDoc = InferSchemaType<typeof schema>;
export const Player: Model<PlayerDoc> =
  mongoose.models.Player ?? mongoose.model("Player", schema);
