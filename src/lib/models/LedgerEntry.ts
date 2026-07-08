import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const schema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "MISSION_PAYOUT",
        "HEIST_PAYOUT",
        "STOCK_SALE",
        "SAFE_COLLECT",
        "ASSET_PURCHASE",
        "UPGRADE_PURCHASE",
        "SUPPLY_PURCHASE",
        "HEIST_BUYIN",
        "REFUND",
      ],
      required: true,
    },
    amountCash: { type: Number, required: true }, // signed
    amountRp: { type: Number, default: 0 },
    refId: { type: String },
    note: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    netWorthAfter: { type: Number, required: true },
    dayKey: { type: String, required: true },
  },
  { timestamps: true }
);

schema.index({ createdAt: 1 });

export type LedgerEntryDoc = InferSchemaType<typeof schema>;
export const LedgerEntry: Model<LedgerEntryDoc> =
  mongoose.models.LedgerEntry ?? mongoose.model("LedgerEntry", schema);
