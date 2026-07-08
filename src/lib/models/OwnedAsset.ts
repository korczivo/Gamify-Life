import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    assetId: { type: String, required: true, unique: true },
    class: {
      type: String,
      enum: ["business", "property", "vehicle", "gear"],
      required: true,
    },
    purchasePrice: { type: Number, required: true },
    // production state (business only)
    supplyUnits: { type: Number, default: 0 },
    stockUnits: { type: Number, default: 0 },
    /** Purchased upgrade ids (catalog keys: staff/equipment, tuning slots, rooms). */
    upgrades: { type: [String], default: [] },
    totalEarned: { type: Number, default: 0 },
    isDailyDriver: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type OwnedAssetDoc = InferSchemaType<typeof schema>;
export const OwnedAsset: Model<OwnedAssetDoc> =
  mongoose.models.OwnedAsset ?? mongoose.model("OwnedAsset", schema);
