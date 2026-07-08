import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { dropModelInDev } from "../db";

const schema = new Schema(
  {
    name: { type: String, required: true },
    /** Predefined heist this was started from (see HEIST_TEMPLATES). */
    templateId: { type: String },
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
        /** Legacy model: prep was its own one-off mission. */
        missionId: { type: Schema.Types.ObjectId, ref: "Mission" },
        name: { type: String, required: true },
        /** Authentic GTA prep name from the template — pure flavor. */
        flavor: { type: String },
        /**
         * Current model: prep is a counter filled by completing regular
         * missions of this type ("deepwork" = timer missions).
         */
        requirement: {
          type: String,
          enum: ["marketing", "content", "dev", "admin", "deepwork"],
        },
        /** Deep-work minutes this prep demands. */
        target: { type: Number },
        /** Deep-work minutes banked so far (fractional). */
        progress: { type: Number, default: 0 },
        /** When a live timer is actively running on this prep (else null). */
        runningSince: { type: Date, default: null },
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
dropModelInDev("Heist");
export const Heist: Model<HeistDoc> =
  mongoose.models.Heist ?? mongoose.model("Heist", schema);
