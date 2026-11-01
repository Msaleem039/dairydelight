import express from "express";
import authMiddleware from "../middleware/auth.js";
import adminAuth from "../middleware/adminAuth.js";
import {
  coupons,
  listDeliveredOrders,
  listOrders,
  placeOrder,
  quoteOrder,
  removeCoupon,
  saveCouponRoute,
  trackOrder,
  updateStatus,
  userOrders,
  verifyOrder,
  webhook,
} from "../controllers/orderController.js";

const orderRouter = express.Router();

orderRouter.post("/place", placeOrder);
orderRouter.post("/quote", quoteOrder);
orderRouter.post("/verify", verifyOrder);
orderRouter.post("/userorders", authMiddleware, userOrders);
orderRouter.get("/userorders", authMiddleware, userOrders);
orderRouter.get("/list", adminAuth, listOrders);
orderRouter.post("/status", adminAuth, updateStatus);
orderRouter.post("/status/:id", adminAuth, updateStatus);
orderRouter.patch("/status/:id", adminAuth, updateStatus);
orderRouter.get("/delivered", adminAuth, listDeliveredOrders);
orderRouter.get("/track/:id", trackOrder);
orderRouter.get("/coupons", adminAuth, coupons);
orderRouter.post("/coupons", adminAuth, saveCouponRoute);
orderRouter.delete("/coupons/:code", adminAuth, removeCoupon);
orderRouter.post("/webhook", webhook);

export default orderRouter;
