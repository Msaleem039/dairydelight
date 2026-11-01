import mongoose from "mongoose";

const extraSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  priceCents: { type: Number, required: true },
  available: { type: Boolean, default: true },
});

const extraModel = mongoose.models.extra || mongoose.model("extra", extraSchema);

export default extraModel;
