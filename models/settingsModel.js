import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  timezone: { type: String, default: "Europe/Paris" },
  hours: { type: Object, default: {} },
  deliveryEnabled: { type: Boolean, default: true },
  pickupEnabled: { type: Boolean, default: true },
  minOrderCents: { type: Number, default: 0 },
  deliveryFeeCents: { type: Number, default: 290 },
  freeDeliveryFromCents: { type: Number, default: 2500 },
  prepMinutes: { type: Number, default: 25 },
  vatRate: { type: Number, default: 10 },
  allowScheduled: { type: Boolean, default: false },
  closures: { type: Array, default: [] },
  complements: { type: Array, default: [] },
});

const settingsModel = mongoose.models.restaurantSettings || mongoose.model("restaurantSettings", settingsSchema);

export default settingsModel;
