import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    templateId: { type: Schema.Types.ObjectId, ref: "MissionTemplate" },
    slot: { type: Number }, // 0..timesPerPeriod-1 for template instances
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
    targetCount: { type: Number },
    durationMinutes: { type: Number },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    cashReward: { type: Number, required: true },
    rpReward: { type: Number, required: true },
    tickWeight: { type: Number, required: true },
    /** dayKey for daily/one-off missions, weekKey for weekly ones. */
    periodKey: { type: String, required: true },
    progress: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "completed"], default: "open" },
    completedAt: { type: Date },
    isOneOff: { type: Boolean, default: false },
    heistId: { type: Schema.Types.ObjectId, ref: "Heist" },
    prepKind: { type: String, enum: ["mandatory", "optional"] },
  },
  { timestamps: true }
);

schema.index({ periodKey: 1, status: 1 });
// Makes lazy daily/weekly materialization idempotent.
schema.index(
  { templateId: 1, periodKey: 1, slot: 1 },
  { unique: true, partialFilterExpression: { templateId: { $exists: true } } }
);

export type MissionDoc = InferSchemaType<typeof schema>;
export const Mission: Model<MissionDoc> =
  mongoose.models.Mission ?? mongoose.model("Mission", schema);
