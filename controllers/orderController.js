import Stripe from "stripe";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import sendEmail from "../middleware/sendEmail.js";
import { readToken } from "../middleware/auth.js";
import {
  applyPaymentEvent,
  deleteCoupon,
  listCoupons,
  ordersForAdmin,
  ordersForUser,
  orderForViewer,
  placeOrder as placeRestaurantOrder,
  quoteCart,
  saveCoupon,
  updateOrderAdmin,
} from "../services/store.js";

function fail(res, code, status = 400, extra = {}) {
  return res.status(status).json({ success: false, error: code, message: code, ...extra });
}

function publicQuote(quote) {
  const { _built, ...rest } = quote;
  return rest;
}

const placeOrder = async (req, res) => {
  try {
    if (Array.isArray(req.body.lines)) {
      const result = await placeRestaurantOrder({
        lines: req.body.lines,
        service: req.body.service,
        couponCode: req.body.couponCode,
        scheduled: req.body.scheduled,
        userId: readToken(req),
        idempotencyKey: req.body.idempotencyKey,
        expectedTotalCents: Number(req.body.expectedTotalCents),
        paymentMethod: req.body.paymentMethod,
        customer: req.body.customer ?? {},
      });
      if (!result.ok) {
        const extra = result.quote ? { quote: publicQuote(result.quote) } : {};
        return fail(res, result.code, result.code === "forbidden" ? 403 : 400, extra);
      }
      notifyAdmin(result.order).catch(() => {});
      return res.status(result.replayed ? 200 : 201).json({
        success: true,
        message: "Order placed",
        orderId: result.order.id,
        order: result.order,
        replayed: result.replayed,
      });
    }

    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return fail(res, "empty");
    }
    if (!req.body.amount || typeof req.body.amount !== "number") {
      return fail(res, "generic", 400, { message: "Amount is required and must be a number" });
    }
    if (!req.body.address || typeof req.body.address !== "object") {
      return fail(res, "address");
    }
    const newOrder = new orderModel({
      userId: req.body.userId || null,
      items: req.body.items,
      amount: req.body.amount,
      address: req.body.address,
      status: "pending",
      payment: false,
      paymentStatus: "unpaid",
      paymentMethod: "cod",
    });
    await newOrder.save();
    if (req.body.userId) {
      await userModel.findByIdAndUpdate(req.body.userId, { cartData: {} }).catch(() => {});
    }
    return res.json({ success: true, message: "Order placed successfully (Cash on Delivery)", orderId: newOrder._id });
  } catch (error) {
    console.log("Place Order Error:", error);
    return fail(res, "generic");
  }
};

async function notifyAdmin(order) {
  const email = process.env.ORDER_NOTIFY_EMAIL;
  if (!email) return;
  await sendEmail({
    email,
    subject: `New Order Received - Order #${order.id}`,
    templatePath: "order-notification.ejs",
    templateData: {
      orderId: order.id,
      status: order.status,
      orderDate: order.createdAt,
      userId: order.customer?.name || "Guest",
      items: order.items,
      amount: order.total,
      address: order.customer,
    },
  });
}

const quoteOrder = async (req, res) => {
  if (!Array.isArray(req.body?.lines)) return fail(res, "generic");
  const quote = await quoteCart({
    lines: req.body.lines,
    service: req.body.service,
    couponCode: req.body.couponCode,
    scheduled: req.body.scheduled,
    userId: readToken(req),
    phone: req.body.phone || req.body.customer?.phone || "",
  });
  return res.json({ success: true, ...publicQuote(quote) });
};

const verifyOrder = async (req, res) => {
  return fail(res, "payment_locked", 400, {
    message: "Payment is confirmed by the payment provider, not by this page.",
  });
};

const userOrders = async (req, res) => {
  try {
    const orders = await ordersForUser(req.body.userId);
    return res.json({ success: true, data: orders, orders });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const listOrders = async (req, res) => {
  try {
    const orders = await ordersForAdmin();
    const status = req.query.status ?? "pending";
    const data = status === "all" ? orders : orders.filter((order) => order.status === status);
    return res.json({ success: true, data, orders: data });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const updateStatus = async (req, res) => {
  try {
    const id = req.params.id || req.body.orderId;
    const result = await updateOrderAdmin(id, {
      status: req.body.status,
      fulfillment: req.body.fulfillment,
      payment: req.body.payment,
    });
    if (!result.ok) return fail(res, result.code, result.code === "not_found" ? 404 : 400);
    return res.json({ success: true, message: "Status Updated Successfully", order: result.order });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const listDeliveredOrders = async (req, res) => {
  try {
    const orders = (await ordersForAdmin()).filter((order) => order.status !== "pending");
    return res.json({ success: true, data: orders, orders });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const trackOrder = async (req, res) => {
  const order = await orderForViewer(req.params.id, {
    userId: readToken(req),
    token: req.headers["x-order-token"] || "",
    phone: req.query.phone || "",
    admin: false,
  });
  if (!order) return fail(res, "not_found", 404);
  return res.json({ success: true, order });
};

const coupons = async (req, res) => {
  return res.json({ success: true, coupons: await listCoupons() });
};

const saveCouponRoute = async (req, res) => {
  const result = await saveCoupon(req.body ?? {});
  if (!result.ok) return fail(res, result.code);
  return res.json({ success: true, coupons: result.coupons });
};

const removeCoupon = async (req, res) => {
  await deleteCoupon(req.params.code);
  return res.json({ success: true });
};

const webhook = async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ success: false, error: "generic" });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_unconfigured");
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], secret);
  } catch (error) {
    console.log(error.message);
    return fail(res, "generic");
  }
  const object = event.data?.object ?? {};
  const orderId = object.metadata?.orderId || object.client_reference_id;
  const amount = object.amount_total ?? object.amount_received ?? object.amount;
  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    const result = await applyPaymentEvent({ id: event.id, type: "paid", orderId, amountCents: amount });
    if (!result.ok) return fail(res, result.code);
    return res.json({ received: true, duplicate: Boolean(result.duplicate) });
  }
  if (event.type === "payment_intent.payment_failed") {
    await applyPaymentEvent({ id: event.id, type: "failed", orderId });
    return res.json({ received: true });
  }
  if (event.type === "payment_intent.canceled") {
    await applyPaymentEvent({ id: event.id, type: "cancelled", orderId });
    return res.json({ received: true });
  }
  return res.json({ received: true, ignored: true });
};

export {
  placeOrder,
  quoteOrder,
  verifyOrder,
  userOrders,
  listOrders,
  updateStatus,
  listDeliveredOrders,
  trackOrder,
  coupons,
  saveCouponRoute,
  removeCoupon,
  webhook,
};
