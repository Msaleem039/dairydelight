import mongoose from "mongoose";

const paymentEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const paymentEventModel = mongoose.models.paymentEvent || mongoose.model("paymentEvent", paymentEventSchema);

export default paymentEventModel;
