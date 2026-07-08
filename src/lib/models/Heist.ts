import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    name: { type: String, required: true },
    tier: { type: String, enum: ["small", "medium", "big", "cayo"], required: true },
    status: {
      type: String,
      enum: ["scoping", "active", "completed", "archived"],
      default: "scoping",
    },
    buyIn: { type: Number, required: true },
    basePayout: { type: Number, required: true },
    loot: {
      kind: { type: String },
      multiplier: { type: Number },
    },
    preps: [
      {
        missionId: { type: Schema.Types.ObjectId, ref: "Mission" },
        name: { type: String, required: true },
        kind: { type: String, enum: ["mandatory", "optional"], required: true },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
      },
    ],
    finaleName: { type: String, required: true },
    hardMode: { type: Boolean, default: false },
    payout: { type: Number },
    eliteAchieved: { type: Boolean },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export type HeistDoc = InferSchemaType<typeof schema>;
export const Heist: Model<HeistDoc> =
  mongoose.models.Heist ?? mongoose.model("Heist", schema);
