import userModel from "../models/userModel.js";
import { lineKey } from "../services/store.js";

const addToCart = async (req, res) => {
  try {
    const userData = await userModel.findById(req.body.userId);
    const cartData = userData.cartData || {};
    const variantIds = Array.isArray(req.body.variantIds) ? req.body.variantIds : [];
    const extraIds = Array.isArray(req.body.extraIds) ? req.body.extraIds : [];
    const key = variantIds.length || extraIds.length ? lineKey(req.body.itemId, variantIds, extraIds) : req.body.itemId;
    const amount = Math.max(1, Number(req.body.quantity) || 1);
    if (!cartData[key] || typeof cartData[key] === "number") {
      cartData[key] = (Number(cartData[key]) || 0) + amount;
    } else {
      cartData[key].quantity = (cartData[key].quantity || 0) + amount;
    }
    if (variantIds.length || extraIds.length) {
      cartData[key] = { quantity: typeof cartData[key] === "number" ? cartData[key] : cartData[key].quantity, variantIds, extraIds, itemId: req.body.itemId };
    }
    await userModel.findByIdAndUpdate(req.body.userId, { cartData });
    return res.json({ success: true, message: "Added to cart", cartData });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userData = await userModel.findById(req.body.userId);
    const cartData = userData.cartData || {};
    const key = req.body.lineId || req.body.itemId;
    if (typeof cartData[key] === "number" && cartData[key] > 0) cartData[key] -= 1;
    else if (cartData[key]?.quantity > 0) cartData[key].quantity -= 1;
    if (cartData[key] === 0 || cartData[key]?.quantity === 0) delete cartData[key];
    await userModel.findByIdAndUpdate(req.body.userId, { cartData });
    return res.json({ success: true, message: "Removed from cart", cartData });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error" });
  }
};

const getCart = async (req, res) => {
  try {
    const userData = await userModel.findById(req.body.userId);
    return res.json({ success: true, cartData: userData.cartData || {} });
  } catch (error) {
    console.log(error);
    return res.json({ success: false, message: "Error" });
  }
};

export { addToCart, removeFromCart, getCart };
