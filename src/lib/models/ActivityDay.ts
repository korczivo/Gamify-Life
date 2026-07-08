import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    dayKey: { type: String, required: true, unique: true },
    missionsCompleted: { type: Number, default: 0 },
    hardCompleted: { type: Number, default: 0 },
    cashEarned: { type: Number, default: 0 },
    rpEarned: { type: Number, default: 0 },
    deepWorkMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type ActivityDayDoc = InferSchemaType<typeof schema>;
export const ActivityDay: Model<ActivityDayDoc> =
  mongoose.models.ActivityDay ?? mongoose.model("ActivityDay", schema);
