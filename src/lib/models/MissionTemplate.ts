import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    name: { type: String, required: true },
    businessType: {
      type: String,
      enum: ["marketing", "content", "dev", "admin"],
      required: true,
    },
    objectiveType: {
      type: String,
      enum: ["checkbox", "counter", "timer"],
      required: true,
    },
    targetCount: { type: Number }, // counter only
    durationMinutes: { type: Number }, // timer only
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    cashReward: { type: Number, required: true },
    rpReward: { type: Number, required: true },
    schedule: {
      kind: { type: String, enum: ["daily", "weekly"], required: true },
      timesPerPeriod: { type: Number, default: 1 },
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type MissionTemplateDoc = InferSchemaType<typeof schema>;
export const MissionTemplate: Model<MissionTemplateDoc> =
  mongoose.models.MissionTemplate ?? mongoose.model("MissionTemplate", schema);
