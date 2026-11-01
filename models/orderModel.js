import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: false, default: null },
  items: { type: Array, required: true },
  amount: { type: Number, required: true },
  address: { type: Object, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "preparing", "ready", "on_the_way", "shipped", "delivered", "completed", "cancelled"],
    default: "pending",
  },
  date: { type: Date, default: Date.now },
  payment: { type: Boolean, default: false },
  reference: { type: String, unique: true, sparse: true },
  idempotencyKey: { type: String, unique: true, sparse: true },
  accessToken: { type: String, default: "" },
  paymentStatus: { type: String, enum: ["unpaid", "pending", "paid", "failed", "cancelled"], default: "unpaid" },
  paymentMethod: { type: String, enum: ["cod", "online"], default: "cod" },
  service: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  vatIncluded: { type: Number, default: 0 },
  vatRate: { type: Number, default: 10 },
  couponCode: { type: String, default: null },
  scheduledFor: { type: Date, default: null },
  customer: {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  phoneDigits: { type: String, default: "" },
});

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
