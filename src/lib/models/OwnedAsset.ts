import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { dropModelInDev } from "../db";

const schema = new Schema(
  {
    assetId: { type: String, required: true, unique: true },
    class: {
      type: String,
      enum: ["business", "property", "gear"],
      required: true,
    },
    purchasePrice: { type: Number, required: true },
    // production state (business only)
    supplyUnits: { type: Number, default: 0 },
    stockUnits: { type: Number, default: 0 },
    /** Purchased upgrade ids (catalog keys: staff/equipment, property rooms). */
    upgrades: { type: [String], default: [] },
    totalEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type OwnedAssetDoc = InferSchemaType<typeof schema>;
dropModelInDev("OwnedAsset");
export const OwnedAsset: Model<OwnedAssetDoc> =
  mongoose.models.OwnedAsset ?? mongoose.model("OwnedAsset", schema);
