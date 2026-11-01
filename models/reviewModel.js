import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  orderId: { type: String, required: true },
  orderItemId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  body: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected", "hidden"], default: "pending" },
  authorName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const reportSchema = new mongoose.Schema({
  reviewId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  createdAt: { type: Date, default: Date.now },
});

export const reviewModel = mongoose.models.review || mongoose.model("review", reviewSchema);
export const reportModel = mongoose.models.reviewReport || mongoose.model("reviewReport", reportSchema);
