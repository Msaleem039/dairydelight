import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ["percent", "fixed"], required: true },
  value: { type: Number, required: true },
  minSubtotalCents: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  startsAt: { type: Date, default: null },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
});

const redemptionSchema = new mongoose.Schema({
  code: { type: String, required: true, index: true },
  userId: { type: String, default: null },
  phoneDigits: { type: String, default: "" },
  orderId: { type: String, required: true },
});

export const couponModel = mongoose.models.coupon || mongoose.model("coupon", couponSchema);
export const redemptionModel = mongoose.models.couponRedemption || mongoose.model("couponRedemption", redemptionSchema);
