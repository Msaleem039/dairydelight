import mongoose from "mongoose";

const foodSchema = new mongoose.Schema({
  code: { type: String, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  slug: { type: String, index: true },
  available: { type: Boolean, default: true },
  stock: { type: Number, default: null },
  allergens: { type: String, default: "" },
  ingredients: { type: String, default: "" },
  isCombo: { type: Boolean, default: false },
  variants: {
    type: [
      {
        id: String,
        group: String,
        name: String,
        priceDelta: Number,
        available: { type: Boolean, default: true },
      },
    ],
    default: [],
  },
  extraIds: { type: [String], default: [] },
  relatedIds: { type: [String], default: [] },
});

const foodModel = mongoose.models.food || mongoose.model("food", foodSchema);

export default foodModel;
