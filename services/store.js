import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import foodModel from "../models/foodModel.js";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";
import extraModel from "../models/extraModel.js";
import settingsModel from "../models/settingsModel.js";
import paymentEventModel from "../models/paymentEventModel.js";
import { reviewModel, reportModel } from "../models/reviewModel.js";
import { couponModel, redemptionModel } from "../models/couponModel.js";
import { CATEGORIES, COMPLEMENTS, DISHES, EXTRA_SEED } from "./menu.js";
import {
  DEFAULT_SETTINGS,
  allergenText,
  centsToEuros,
  deliveryFeeCents,
  dishSlug,
  eurosToCents,
  evaluateCoupon,
  hoursShort,
  includedVatCents,
  isOpenAt,
  nextOpening,
  normalizeFulfillment,
  orderingDecision,
  phoneDigits,
  publicAuthor,
  recommendProducts,
  reviewEligibility,
  sanitizeText,
} from "../lib/rules.js";

function publicId(doc) {
  return doc.code || String(doc._id);
}

function settingsShape(doc) {
  const hours = doc?.hours && Object.keys(doc.hours).length ? doc.hours : DEFAULT_SETTINGS.hours;
  return {
    timezone: doc?.timezone || DEFAULT_SETTINGS.timezone,
    hours,
    deliveryEnabled: doc?.deliveryEnabled !== false,
    pickupEnabled: doc?.pickupEnabled !== false,
    minOrderCents: Number(doc?.minOrderCents ?? DEFAULT_SETTINGS.minOrderCents),
    deliveryFeeCents: Number(doc?.deliveryFeeCents ?? DEFAULT_SETTINGS.deliveryFeeCents),
    freeDeliveryFromCents: Number(doc?.freeDeliveryFromCents ?? DEFAULT_SETTINGS.freeDeliveryFromCents),
    prepMinutes: Number(doc?.prepMinutes ?? DEFAULT_SETTINGS.prepMinutes),
    vatRate: Number(doc?.vatRate ?? DEFAULT_SETTINGS.vatRate),
    allowScheduled: Boolean(doc?.allowScheduled),
    closures: Array.isArray(doc?.closures) ? doc.closures : [],
    complements: Array.isArray(doc?.complements) ? doc.complements : [],
  };
}

export async function readSettings() {
  const doc = await settingsModel.findOne({ key: "restaurant" }).lean();
  return settingsShape(doc);
}

export async function publicInfo(now = new Date()) {
  const settings = await readSettings();
  const closures = settings.closures;
  const deliveryOpen = settings.deliveryEnabled && isOpenAt(now, settings, closures, "delivery");
  const pickupOpen = settings.pickupEnabled && isOpenAt(now, settings, closures, "pickup");
  const openNow = deliveryOpen || pickupOpen;
  const service = settings.deliveryEnabled ? "delivery" : "pickup";
  return {
    timezone: settings.timezone,
    hoursShort: hoursShort(settings),
    hours: settings.hours,
    closures,
    openNow,
    deliveryOpen,
    pickupOpen,
    nextOpenAt: openNow ? null : nextOpening(now, settings, closures, service),
    deliveryEnabled: settings.deliveryEnabled,
    pickupEnabled: settings.pickupEnabled,
    minOrder: centsToEuros(settings.minOrderCents),
    deliveryFee: centsToEuros(settings.deliveryFeeCents),
    freeDeliveryFrom: centsToEuros(settings.freeDeliveryFromCents),
    prepMinutes: settings.prepMinutes,
    vatRate: settings.vatRate,
    allowScheduled: settings.allowScheduled,
  };
}

async function reviewStats(productId) {
  const rows = await reviewModel.aggregate([
    { $match: { productId, status: "approved" } },
    { $group: { _id: "$rating", n: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const row of rows) {
    distribution[row._id] = row.n;
    count += row.n;
    sum += row._id * row.n;
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution };
}

export async function mapProduct(doc, extrasByCode, stats) {
  const id = publicId(doc);
  const stock = doc.stock === undefined ? null : doc.stock;
  const available = doc.available !== false;
  const orderable = available && (stock === null || stock > 0);
  const extraIds = doc.extraIds ?? [];
  const extras = extraIds.map((code) => extrasByCode.get(code)).filter(Boolean);
  const rating = stats.get(id) ?? { average: null, count: 0 };
  return {
    id,
    _id: doc._id,
    slug: doc.slug || dishSlug({ name: doc.name, id }),
    name: doc.name,
    description: doc.description,
    price: doc.price,
    image: doc.image,
    category: doc.category,
    available,
    orderable,
    stock,
    allergens: doc.allergens || "",
    ingredients: doc.ingredients || "",
    isCombo: Boolean(doc.isCombo),
    variants: (doc.variants ?? []).map((variant) => ({
      id: variant.id,
      group: variant.group,
      name: variant.name,
      priceDelta: variant.priceDelta,
      available: variant.available !== false,
    })),
    extras,
    relatedIds: doc.relatedIds ?? [],
    reviewAverage: rating.average,
    reviewCount: rating.count,
  };
}

async function extrasMap() {
  const extras = await extraModel.find({}).lean();
  const map = new Map();
  for (const extra of extras) {
    map.set(extra.code, { id: extra.code, name: extra.name, price: centsToEuros(extra.priceCents), available: extra.available !== false });
  }
  return map;
}

export async function listProducts() {
  const [foods, extrasByCode, statsRows] = await Promise.all([
    foodModel.find({}).sort({ name: 1 }).lean(),
    extrasMap(),
    reviewModel.aggregate([{ $match: { status: "approved" } }, { $group: { _id: { productId: "$productId", rating: "$rating" }, n: { $sum: 1 } } }]),
  ]);
  const grouped = new Map();
  for (const row of statsRows) {
    const id = row._id.productId;
    const current = grouped.get(id) ?? { sum: 0, count: 0 };
    current.sum += row._id.rating * row.n;
    current.count += row.n;
    grouped.set(id, current);
  }
  const stats = new Map();
  for (const [id, value] of grouped) {
    stats.set(id, { average: value.count ? Math.round((value.sum / value.count) * 10) / 10 : null, count: value.count });
  }
  const products = [];
  for (const food of foods) products.push(await mapProduct(food, extrasByCode, stats));
  return products;
}

export async function productBySlug(slug) {
  const foods = await foodModel.find({}).lean();
  const extrasByCode = await extrasMap();
  const match = foods.find((food) => (food.slug || dishSlug({ name: food.name, id: publicId(food) })) === slug);
  if (!match) return null;
  const stats = new Map();
  const rating = await reviewStats(publicId(match));
  stats.set(publicId(match), rating);
  return mapProduct(match, extrasByCode, stats);
}

export async function listExtras() {
  const extras = await extraModel.find({}).sort({ name: 1 }).lean();
  return extras.map((extra) => ({ id: extra.code, name: extra.name, price: centsToEuros(extra.priceCents), available: extra.available !== false }));
}

async function findFood(productId) {
  return foodModel.findOne({ $or: [{ code: productId }, { _id: productId }] }).catch(() => foodModel.findOne({ code: productId }));
}

async function priceLines(lines) {
  const issues = [];
  const priced = [];
  const used = new Map();
  const extrasByCode = await extrasMap();
  for (const line of lines ?? []) {
    const productId = sanitizeText(line.productId, 80);
    const quantity = Number(line.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      issues.push({ code: "bad_quantity", productId });
      continue;
    }
    const product = await findFood(productId);
    if (!product || product.available === false) {
      issues.push({ code: "unavailable", productId });
      continue;
    }
    const id = publicId(product);
    const variantIds = Array.isArray(line.variantIds) ? line.variantIds.map((item) => sanitizeText(item, 40)) : [];
    const extraIds = Array.isArray(line.extraIds) ? [...new Set(line.extraIds.map((item) => sanitizeText(item, 40)))] : [];
    let delta = 0;
    const labels = [];
    let invalid = false;
    const groups = new Set();
    for (const variantId of variantIds) {
      const variant = (product.variants ?? []).find((item) => item.id === variantId);
      if (!variant || variant.available === false || groups.has(variant.group)) {
        invalid = true;
        break;
      }
      groups.add(variant.group);
      delta += eurosToCents(variant.priceDelta || 0);
      labels.push(variant.name);
    }
    for (const extraId of extraIds) {
      const extra = extrasByCode.get(extraId);
      if (!extra || extra.available === false || !(product.extraIds ?? []).includes(extraId)) {
        invalid = true;
        break;
      }
      delta += eurosToCents(extra.price);
      labels.push(extra.name);
    }
    if (invalid) {
      issues.push({ code: "bad_options", productId: id });
      continue;
    }
    const nextUsed = (used.get(id) ?? 0) + quantity;
    if (product.stock !== null && product.stock !== undefined && nextUsed > Number(product.stock)) {
      issues.push({ code: "stock", productId: id });
      continue;
    }
    used.set(id, nextUsed);
    const unit = Math.max(0, eurosToCents(product.price) + delta);
    priced.push({
      lineId: [id, ...[...variantIds].sort(), ...[...extraIds].sort()].join("|"),
      itemId: randomUUID(),
      productId: id,
      name: product.name,
      quantity,
      unitPrice: centsToEuros(unit),
      lineTotal: centsToEuros(unit * quantity),
      unitPriceCents: unit,
      lineTotalCents: unit * quantity,
      image: product.image,
      optionsLabel: labels.join(", "),
      allergens: product.allergens || "",
      category: product.category,
      variantIds,
      extraIds,
    });
  }
  return { lines: priced, issues };
}

async function couponFor(code, userId, phone) {
  const row = await couponModel.findOne({ code: code.trim().toUpperCase() }).lean();
  if (!row) return null;
  const digits = phoneDigits(phone);
  const ors = [...(userId ? [{ userId }] : []), ...(digits ? [{ phoneDigits: digits }] : [])];
  const userRedemptions = ors.length ? await redemptionModel.countDocuments({ code: row.code, $or: ors }) : 0;
  return {
    code: row.code,
    type: row.type === "fixed" ? "fixed" : "percent",
    value: Number(row.value),
    minSubtotalCents: Number(row.minSubtotalCents || 0),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    usageLimit: row.usageLimit === undefined || row.usageLimit === null ? null : Number(row.usageLimit),
    usedCount: Number(row.usedCount || 0),
    perUserLimit: Number(row.perUserLimit ?? 1),
    userRedemptions,
    active: row.active !== false,
  };
}

export async function quoteCart(input, now = new Date()) {
  const settings = await readSettings();
  const service = input.service === "pickup" ? "pickup" : "delivery";
  const built = await priceLines(input.lines ?? []);
  const subtotalCents = built.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const couponCode = sanitizeText(input.couponCode, 40).toUpperCase();
  const coupon = couponCode ? await couponFor(couponCode, input.userId ?? null, input.phone ?? "") : null;
  const couponResult = couponCode ? evaluateCoupon(coupon, subtotalCents, now) : { ok: true, discountCents: 0, code: "" };
  const discountCents = couponResult.ok ? couponResult.discountCents : 0;
  const fee = deliveryFeeCents(subtotalCents, settings, service);
  const totalCents = subtotalCents - discountCents + fee;
  const decision = orderingDecision(now, settings, settings.closures, service, input.scheduled ?? null);
  const belowMinimum = subtotalCents > 0 && subtotalCents < settings.minOrderCents;
  const issueCode = built.issues[0]?.code;
  const orderingCode = !decision.ok ? decision.code : belowMinimum ? "minimum" : issueCode ?? (built.lines.length === 0 ? "empty" : "ok");
  const couponBlocks = Boolean(couponCode) && !couponResult.ok;
  return {
    lines: built.lines.map((line) => ({
      lineId: line.lineId,
      productId: line.productId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      image: line.image,
      optionsLabel: line.optionsLabel,
      allergens: line.allergens,
      category: line.category,
    })),
    issues: built.issues,
    subtotal: centsToEuros(subtotalCents),
    discount: centsToEuros(discountCents),
    deliveryFee: centsToEuros(fee),
    vatIncluded: centsToEuros(includedVatCents(totalCents, settings.vatRate)),
    vatRate: settings.vatRate,
    total: centsToEuros(totalCents),
    totalCents,
    couponCode,
    couponStatus: couponResult.code,
    service,
    orderingCode,
    nextOpenAt: decision.nextOpenAt ?? null,
    canSubmit: built.issues.length === 0 && built.lines.length > 0 && decision.ok && !belowMinimum && !couponBlocks,
    prepMinutes: settings.prepMinutes,
    minOrder: centsToEuros(settings.minOrderCents),
    scheduledFor: decision.ok ? decision.scheduledFor : null,
    _built: built,
  };
}

function mapOrder(doc, includeToken = false) {
  const customer = doc.customer ?? {};
  const address = typeof doc.address === "object" && doc.address ? doc.address : {};
  return {
    id: doc.reference || String(doc._id),
    items: (doc.items ?? []).map((item, index) => ({
      id: item.id || item.itemId || `${doc._id}-${index}`,
      productId: item.productId || item._id || item.id || "",
      name: item.name || "",
      price: Number(item.price ?? item.unitPrice ?? 0),
      quantity: Number(item.quantity || 1),
      image: item.image || "",
      optionsLabel: item.optionsLabel || "",
      allergens: item.allergens || "",
    })),
    subtotal: Number(doc.subtotal ?? doc.amount ?? 0),
    discount: Number(doc.discount || 0),
    deliveryFee: Number(doc.deliveryFee || 0),
    vatIncluded: Number(doc.vatIncluded || 0),
    vatRate: Number(doc.vatRate ?? 10),
    total: Number(doc.amount || 0),
    paymentMethod: doc.paymentMethod === "online" ? "online" : "cod",
    paymentStatus: doc.paymentStatus || (doc.payment ? "paid" : "unpaid"),
    status: normalizeFulfillment(doc.status || "pending"),
    service: doc.service === "pickup" ? "pickup" : "delivery",
    couponCode: doc.couponCode || null,
    customer: {
      name: customer.name || address.name || "",
      phone: customer.phone || address.phone || "",
      email: customer.email || address.email || "",
      address: customer.address || address.address || address.street || "",
      note: customer.note || address.note || "",
    },
    scheduledFor: doc.scheduledFor ? new Date(doc.scheduledFor).toISOString() : null,
    createdAt: new Date(doc.date || Date.now()).toISOString(),
    ...(includeToken && doc.accessToken ? { accessToken: doc.accessToken } : {}),
  };
}

async function restoreStock(quantities) {
  for (const [productId, quantity] of quantities) {
    const product = await findFood(productId);
    if (product && product.stock !== null && product.stock !== undefined) {
      await foodModel.findByIdAndUpdate(product._id, { $inc: { stock: quantity } });
    }
  }
}

function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let id = "OM-";
  for (const byte of bytes) id += alphabet[byte % alphabet.length];
  return id;
}

export async function placeOrder(input, now = new Date()) {
  const key = sanitizeText(input.idempotencyKey, 80);
  if (key.length < 16) return { ok: false, code: "generic" };
  const userId = input.userId ? String(input.userId) : null;
  const existing = await orderModel.findOne({ idempotencyKey: key });
  if (existing) {
    if ((existing.userId || null) !== userId) return { ok: false, code: "forbidden" };
    return { ok: true, order: mapOrder(existing, true), replayed: true };
  }
  const name = sanitizeText(input.customer?.name, 80);
  const phone = sanitizeText(input.customer?.phone, 30);
  const email = sanitizeText(input.customer?.email, 120).toLowerCase();
  const address = sanitizeText(input.customer?.address, 240);
  const note = sanitizeText(input.customer?.note, 300);
  const digits = phoneDigits(phone);
  if (name.length < 2 || digits.length < 8) return { ok: false, code: "customer" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, code: "email" };
  const service = input.service === "pickup" ? "pickup" : "delivery";
  if (service === "delivery" && address.length < 8) return { ok: false, code: "address" };
  const method = input.paymentMethod === "online" ? "online" : "cod";
  const paymentStatus = method === "online" ? "pending" : "unpaid";
  const preview = await quoteCart({ ...input, userId, phone }, now);
  if (!preview.canSubmit) return { ok: false, code: preview.orderingCode === "ok" ? preview.couponStatus || "generic" : preview.orderingCode, quote: preview };
  if (preview.totalCents !== Number(input.expectedTotalCents)) return { ok: false, code: "total_changed", quote: preview };

  const quantities = new Map();
  for (const line of preview._built.lines) quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  for (const [productId, quantity] of quantities) {
    const product = await findFood(productId);
    if (!product) return { ok: false, code: "unavailable" };
    if (product.stock !== null && product.stock !== undefined) {
      const updated = await foodModel.findOneAndUpdate({ _id: product._id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } });
      if (!updated) return { ok: false, code: "stock" };
    }
  }

  const couponCode = preview.couponCode || null;
  if (couponCode) {
    const rule = await couponFor(couponCode, userId, phone);
    if (!rule || rule.userRedemptions >= rule.perUserLimit) {
      await restoreStock(quantities);
      return { ok: false, code: "coupon_user_limit" };
    }
    const updated = await couponModel.findOneAndUpdate(
      { code: couponCode, active: true, $or: [{ usageLimit: null }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] },
      { $inc: { usedCount: 1 } },
    );
    if (!updated) {
      await restoreStock(quantities);
      return { ok: false, code: "coupon_limit" };
    }
  }

  const reference = newReference();
  const token = randomBytes(24).toString("hex");
  try {
    const order = await orderModel.create({
      userId,
      reference,
      idempotencyKey: key,
      accessToken: token,
      items: preview._built.lines.map((line) => ({
        id: line.itemId,
        productId: line.productId,
        name: line.name,
        price: line.unitPrice,
        quantity: line.quantity,
        image: line.image,
        optionsLabel: line.optionsLabel,
        allergens: line.allergens,
        variantIds: line.variantIds,
        extraIds: line.extraIds,
      })),
      amount: preview.total,
      address: { name, phone, email, address, note },
      status: "pending",
      payment: false,
      paymentStatus,
      paymentMethod: method,
      service,
      subtotal: preview.subtotal,
      discount: preview.discount,
      deliveryFee: preview.deliveryFee,
      vatIncluded: preview.vatIncluded,
      vatRate: preview.vatRate,
      couponCode,
      scheduledFor: preview.scheduledFor ? new Date(preview.scheduledFor) : null,
      customer: { name, phone, email, address, note },
      phoneDigits: digits,
      date: now,
    });
    if (couponCode) await redemptionModel.create({ code: couponCode, userId, phoneDigits: digits, orderId: reference });
    if (userId) await userModel.findByIdAndUpdate(userId, { cartData: {} }).catch(() => {});
    return { ok: true, order: mapOrder(order, true), replayed: false };
  } catch (error) {
    if (error?.code === 11000) {
      const again = await orderModel.findOne({ idempotencyKey: key });
      if (again) return { ok: true, order: mapOrder(again, true), replayed: true };
    }
    await restoreStock(quantities);
    if (couponCode) await couponModel.updateOne({ code: couponCode }, { $inc: { usedCount: -1 } });
    console.log(error);
    return { ok: false, code: "generic" };
  }
}

export async function ordersForUser(userId) {
  const rows = await orderModel.find({ userId: String(userId) }).sort({ date: -1 });
  return rows.map((row) => mapOrder(row));
}

export async function ordersForAdmin() {
  const rows = await orderModel.find({}).sort({ date: -1 });
  return rows.map((row) => mapOrder(row));
}

export async function orderForViewer(id, viewer) {
  const doc = await orderModel.findOne({ $or: [{ reference: id }, { _id: id }] }).catch(() => orderModel.findOne({ reference: id }));
  if (!doc) return null;
  const owner = viewer.userId && doc.userId && String(doc.userId) === String(viewer.userId);
  const token = viewer.token && doc.accessToken && viewer.token === doc.accessToken;
  const phone = viewer.phone && phoneDigits(viewer.phone) && phoneDigits(viewer.phone) === doc.phoneDigits;
  if (!owner && !token && !phone && !viewer.admin) return null;
  return mapOrder(doc, false);
}

export async function updateOrderAdmin(id, body) {
  const doc = await orderModel.findOne({ $or: [{ reference: id }, { _id: id }] }).catch(() => orderModel.findOne({ reference: id }));
  if (!doc) return { ok: false, code: "not_found" };
  const requested = body.fulfillment || body.status;
  if (requested) {
    const allowed = new Set(["pending", "confirmed", "preparing", "ready", "on_the_way", "completed", "cancelled", "delivered", "shipped"]);
    if (!allowed.has(String(requested))) return { ok: false, code: "generic" };
    doc.status = normalizeFulfillment(String(requested));
  }
  if (body.payment) {
    const payment = String(body.payment);
    if (!["unpaid", "pending", "paid", "failed", "cancelled"].includes(payment)) return { ok: false, code: "generic" };
    if (payment === "paid" && doc.paymentMethod === "online") return { ok: false, code: "payment_locked" };
    doc.paymentStatus = payment;
    doc.payment = payment === "paid";
  }
  await doc.save();
  return { ok: true, order: mapOrder(doc) };
}

export async function applyPaymentEvent(event) {
  const existing = await paymentEventModel.findOne({ eventId: event.id });
  if (existing) return { ok: true, duplicate: true };
  const doc = await orderModel.findOne({ reference: event.orderId });
  if (!doc) return { ok: false, code: "not_found" };
  if (event.type === "paid") {
    const expected = eurosToCents(doc.amount);
    if (Number(event.amountCents) !== expected) return { ok: false, code: "total_changed" };
    doc.paymentStatus = "paid";
    doc.payment = true;
  } else if (event.type === "failed") {
    doc.paymentStatus = "failed";
    doc.payment = false;
  } else if (event.type === "cancelled") {
    doc.paymentStatus = "cancelled";
    doc.payment = false;
  } else return { ok: false, code: "generic" };
  await paymentEventModel.create({ eventId: event.id, orderId: event.orderId, type: event.type });
  await doc.save();
  return { ok: true, duplicate: false };
}

export async function recommendations(ids, limit = 4) {
  const products = await listProducts();
  const settings = await readSettings();
  const anchors = products.filter((product) => ids.includes(product.id)).map((product) => ({ id: product.id, category: product.category }));
  const explicit = [];
  for (const product of products) {
    for (const relatedId of product.relatedIds ?? []) explicit.push({ productId: product.id, relatedId });
  }
  const chosen = recommendProducts({
    anchors,
    catalog: products.map((product) => ({ id: product.id, category: product.category, available: product.orderable, name: product.name })),
    complements: settings.complements,
    explicit,
    excludeIds: ids,
    limit,
  });
  return products.filter((product) => chosen.includes(product.id) && product.orderable);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    address: user.address || "",
    role: user.role === "admin" ? "admin" : "customer",
  };
}

export async function registerCustomer({ name, email, password, role }) {
  const cleanName = sanitizeText(name, 80);
  const cleanEmail = sanitizeText(email, 120).toLowerCase();
  if (cleanName.length < 2) return { ok: false, code: "name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return { ok: false, code: "email" };
  if (String(password ?? "").length < 8) return { ok: false, code: "password" };
  if (await userModel.findOne({ email: cleanEmail })) return { ok: false, code: "email_taken" };
  const hashed = await bcrypt.hash(password, 10);
  const storedRole = role === "admin" ? "admin" : "user";
  const user = await userModel.create({ name: cleanName, email: cleanEmail, password: hashed, role: storedRole });
  return { ok: true, user };
}

export async function updateProfile(userId, input) {
  const name = sanitizeText(input.name, 80);
  const phone = sanitizeText(input.phone, 30);
  const address = sanitizeText(input.address, 240);
  if (name.length < 2) return { ok: false, code: "name" };
  const user = await userModel.findByIdAndUpdate(userId, { name, phone, address }, { new: true });
  if (!user) return { ok: false, code: "not_found" };
  return { ok: true, user: publicUser(user) };
}

export async function saveProduct(input) {
  const name = sanitizeText(input.name, 80);
  const description = sanitizeText(input.description, 600);
  const category = String(input.category ?? "");
  const price = Number(String(input.price ?? "").replace(",", "."));
  const image = String(input.image ?? "");
  const allergens = allergenText(input.allergens);
  if (!allergens.ok) return { ok: false, code: allergens.code };
  if (!name || !description || !CATEGORIES.has(category)) return { ok: false, code: "generic" };
  if (!Number.isFinite(price) || price <= 0 || price > 500) return { ok: false, code: "generic" };
  if (!image || image.length > 1_500_000) return { ok: false, code: "generic" };
  const variants = Array.isArray(input.variants)
    ? input.variants.map((variant) => ({
        id: sanitizeText(variant.id, 40) || randomUUID(),
        group: sanitizeText(variant.group, 40),
        name: sanitizeText(variant.name, 60),
        priceDelta: Number(variant.priceDelta || 0),
        available: variant.available !== false,
      }))
    : undefined;
  const payload = {
    name,
    description,
    category,
    price,
    image,
    allergens: allergens.value,
    ingredients: sanitizeText(input.ingredients, 500),
    available: input.available !== false,
    stock: input.stock === "" || input.stock === undefined || input.stock === null ? null : Number(input.stock),
    isCombo: Boolean(input.isCombo) || category === "formules",
    slug: dishSlug({ name, slug: sanitizeText(input.slug, 80) }),
  };
  if (variants) payload.variants = variants;
  if (Array.isArray(input.extraIds)) payload.extraIds = input.extraIds.map((id) => sanitizeText(id, 40));
  if (Array.isArray(input.relatedIds)) payload.relatedIds = input.relatedIds.map((id) => sanitizeText(id, 80));
  const id = sanitizeText(input.id, 80);
  const existing = id ? await findFood(id) : null;
  const saved = existing ? await foodModel.findByIdAndUpdate(existing._id, payload, { new: true }) : await foodModel.create({ ...payload, code: id || undefined });
  const products = await listProducts();
  return { ok: true, product: products.find((item) => item.id === publicId(saved)) };
}

export async function deleteProduct(id) {
  const existing = await findFood(id);
  if (!existing) return false;
  await foodModel.findByIdAndDelete(existing._id);
  return true;
}

export async function saveExtra(input) {
  const name = sanitizeText(input.name, 80);
  const price = Number(String(input.price ?? "").replace(",", "."));
  if (!name || !Number.isFinite(price) || price < 0 || price > 50) return { ok: false, code: "generic" };
  const code = sanitizeText(input.id, 40) || `ex-${randomUUID().slice(0, 8)}`;
  await extraModel.findOneAndUpdate({ code }, { code, name, priceCents: eurosToCents(price), available: input.available !== false }, { upsert: true, new: true });
  return { ok: true, extras: await listExtras() };
}

export async function deleteExtra(id) {
  await extraModel.deleteOne({ code: id });
  await foodModel.updateMany({}, { $pull: { extraIds: id } });
  return { ok: true };
}

export async function listCoupons() {
  const rows = await couponModel.find({}).sort({ code: 1 }).lean();
  return rows.map((row) => ({
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotal: centsToEuros(row.minSubtotalCents || 0),
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : "",
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : "",
    usageLimit: row.usageLimit ?? "",
    usedCount: row.usedCount || 0,
    perUserLimit: row.perUserLimit ?? 1,
    active: row.active !== false,
  }));
}

export async function saveCoupon(input) {
  const code = sanitizeText(input.code, 40).toUpperCase();
  const type = input.type === "fixed" ? "fixed" : "percent";
  const value = type === "fixed" ? eurosToCents(Number(input.value)) : Number(input.value);
  if (!code || !Number.isFinite(value) || value <= 0) return { ok: false, code: "generic" };
  if (type === "percent" && value > 100) return { ok: false, code: "generic" };
  await couponModel.findOneAndUpdate(
    { code },
    {
      code,
      type,
      value,
      minSubtotalCents: eurosToCents(Number(input.minSubtotal || 0)),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      usageLimit: input.usageLimit === "" || input.usageLimit === null || input.usageLimit === undefined ? null : Number(input.usageLimit),
      perUserLimit: Number(input.perUserLimit || 1),
      active: input.active !== false,
    },
    { upsert: true },
  );
  return { ok: true, coupons: await listCoupons() };
}

export async function deleteCoupon(code) {
  await couponModel.deleteOne({ code: code.toUpperCase() });
  return { ok: true };
}

export async function saveRestaurantSettings(input) {
  const current = await readSettings();
  const hours = input.hours && typeof input.hours === "object" ? input.hours : current.hours;
  const closures = Array.isArray(input.closures)
    ? input.closures.map((closure) => ({
        id: sanitizeText(closure.id, 40) || randomUUID(),
        date: sanitizeText(closure.date, 10),
        service: ["delivery", "pickup", "both"].includes(closure.service) ? closure.service : "both",
        reason: sanitizeText(closure.reason, 160),
      }))
    : current.closures;
  const complements = Array.isArray(input.complements)
    ? input.complements
        .filter((pair) => CATEGORIES.has(pair.category) && CATEGORIES.has(pair.complement))
        .map((pair) => ({ category: pair.category, complement: pair.complement }))
    : current.complements;
  await settingsModel.findOneAndUpdate(
    { key: "restaurant" },
    {
      key: "restaurant",
      timezone: sanitizeText(input.timezone, 60) || current.timezone,
      hours,
      deliveryEnabled: input.deliveryEnabled !== false,
      pickupEnabled: input.pickupEnabled !== false,
      minOrderCents: eurosToCents(Number(input.minOrder ?? centsToEuros(current.minOrderCents))),
      deliveryFeeCents: eurosToCents(Number(input.deliveryFee ?? centsToEuros(current.deliveryFeeCents))),
      freeDeliveryFromCents: eurosToCents(Number(input.freeDeliveryFrom ?? centsToEuros(current.freeDeliveryFromCents))),
      prepMinutes: Number(input.prepMinutes ?? current.prepMinutes),
      vatRate: Number(input.vatRate ?? current.vatRate),
      allowScheduled: Boolean(input.allowScheduled),
      closures,
      complements,
    },
    { upsert: true },
  );
  return { ok: true, info: await publicInfo(), complements };
}

export async function listPublicReviews(query, userId) {
  const pageSize = Math.min(10, Math.max(1, Number(query.pageSize) || 5));
  const page = Math.max(1, Number(query.page) || 1);
  const productId = query.productId ? sanitizeText(query.productId, 80) : "";
  const filter = { status: "approved", ...(productId ? { productId } : {}) };
  const sort = query.sort === "highest" ? { rating: -1, createdAt: -1 } : { createdAt: -1 };
  const total = await reviewModel.countDocuments(filter);
  const rows = await reviewModel
    .find(filter)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();
  const products = await listProducts();
  const byId = new Map(products.map((product) => [product.id, product]));
  const reviews = rows.map((row) => {
    const product = byId.get(row.productId);
    return {
      id: String(row._id),
      productId: row.productId,
      productName: product?.name || "",
      productSlug: product?.slug || "",
      rating: row.rating,
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
      author: publicAuthor(row.authorName),
    };
  });
  let summary = null;
  if (productId) {
    const stats = await reviewStats(productId);
    summary = { average: stats.average, count: stats.count, distribution: Object.fromEntries(Object.entries(stats.distribution).map(([key, value]) => [key, value])) };
  }
  const eligibleOrderItemId = userId && productId ? await eligibleOrderItem(userId, productId) : null;
  return { reviews, summary, page, pageCount: Math.max(1, Math.ceil(total / pageSize)), total, eligibleOrderItemId };
}

async function eligibleOrderItem(userId, productId) {
  const orders = await orderModel.find({ userId: String(userId), status: { $in: ["completed", "delivered"] } }).lean();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      if ((item.productId || "") !== productId) continue;
      const itemId = item.id || item.itemId;
      if (!itemId) continue;
      const existing = await reviewModel.findOne({ orderItemId: itemId });
      if (!existing) return itemId;
    }
  }
  return null;
}

export async function createReview(userId, input) {
  const rating = Number(input.rating);
  const body = sanitizeText(input.body, 1000);
  const productId = sanitizeText(input.productId, 80);
  const orderItemId = sanitizeText(input.orderItemId, 80);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, code: "review_rating" };
  if (body.length < 10) return { ok: false, code: "review_body" };
  const orders = await orderModel.find({ userId: String(userId) }).lean();
  let match = null;
  let item = null;
  for (const order of orders) {
    item = (order.items ?? []).find((entry) => (entry.id || entry.itemId) === orderItemId);
    if (item) {
      match = order;
      break;
    }
  }
  const already = await reviewModel.findOne({ orderItemId });
  const decision = reviewEligibility({
    actorUserId: String(userId),
    orderUserId: match ? String(match.userId) : null,
    fulfillmentStatus: match ? normalizeFulfillment(match.status) : "pending",
    paymentStatus: match?.paymentStatus || "unpaid",
    itemProductId: item?.productId || "",
    requestedProductId: productId,
    orderItemId,
    alreadyReviewed: Boolean(already),
  });
  if (!decision.ok) return decision;
  const user = await userModel.findById(userId);
  const review = await reviewModel.create({
    productId,
    orderId: match.reference || String(match._id),
    orderItemId,
    userId: String(userId),
    rating,
    body,
    status: "pending",
    authorName: user?.name || "",
  });
  return { ok: true, id: String(review._id) };
}

export async function reportReview(userId, reviewId, reason) {
  const review = await reviewModel.findOne({ _id: reviewId, status: "approved" });
  if (!review) return { ok: false, code: "not_found" };
  const body = sanitizeText(reason, 300);
  if (body.length < 5) return { ok: false, code: "review_body" };
  const existing = await reportModel.findOne({ reviewId, userId: String(userId) });
  if (existing) return { ok: true };
  await reportModel.create({ reviewId, userId: String(userId), reason: body });
  return { ok: true };
}

export async function adminReviews() {
  const rows = await reviewModel.find({}).sort({ createdAt: -1 }).lean();
  const products = await listProducts();
  const byId = new Map(products.map((product) => [product.id, product]));
  const reviews = rows.map((row) => {
    const product = byId.get(row.productId);
    return {
      id: String(row._id),
      productId: row.productId,
      productName: product?.name || "",
      productSlug: product?.slug || "",
      rating: row.rating,
      body: row.body,
      createdAt: new Date(row.createdAt).toISOString(),
      author: publicAuthor(row.authorName),
      status: row.status,
    };
  });
  const reports = (await reportModel.find({ status: "open" }).sort({ createdAt: -1 }).lean()).map((row) => ({
    id: String(row._id),
    reviewId: row.reviewId,
    reason: row.reason,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
  return { reviews, reports };
}

export async function moderateReview(id, status) {
  if (!["pending", "approved", "rejected", "hidden"].includes(status)) return { ok: false, code: "generic" };
  const review = await reviewModel.findByIdAndUpdate(id, { status });
  if (!review) return { ok: false, code: "not_found" };
  if (status === "rejected" || status === "hidden") await reportModel.updateMany({ reviewId: id }, { status: "resolved" });
  return { ok: true };
}

export async function resolveReport(id) {
  await reportModel.findByIdAndUpdate(id, { status: "resolved" });
  return { ok: true };
}

export async function importLegacy(input) {
  const products = Array.isArray(input.products) ? input.products : [];
  for (const product of products) {
    if (!product?.name) continue;
    await saveProduct(product);
  }
  return { ok: true };
}

export async function bootstrap() {
  if ((await foodModel.countDocuments({ code: "sp-1" })) === 0 && (await foodModel.countDocuments()) === 0) {
    for (const dish of DISHES) {
      await foodModel.create({
        code: dish.code,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        image: dish.image,
        category: dish.category,
        slug: dishSlug(dish),
        available: true,
        stock: null,
        allergens: "",
        ingredients: "",
        isCombo: dish.isCombo,
        extraIds: EXTRA_SEED.filter((extra) => extra.categories.includes(dish.category)).map((extra) => extra.code),
      });
    }
  }
  if ((await extraModel.countDocuments()) === 0) {
    await extraModel.insertMany(EXTRA_SEED.map((extra) => ({ code: extra.code, name: extra.name, priceCents: extra.priceCents, available: true })));
    const foods = await foodModel.find({});
    for (const food of foods) {
      const links = EXTRA_SEED.filter((extra) => extra.categories.includes(food.category)).map((extra) => extra.code);
      if (links.length && (!food.extraIds || food.extraIds.length === 0)) {
        food.extraIds = links;
        await food.save();
      }
    }
  }
  if (!(await settingsModel.findOne({ key: "restaurant" }))) {
    await settingsModel.create({ key: "restaurant", ...DEFAULT_SETTINGS, closures: [], complements: COMPLEMENTS });
  }
  if (!(await userModel.findOne({ role: "admin" }))) {
    const email = (process.env.ADMIN_EMAIL || "admin@masalahub.fr").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "MasalaHub-Admin";
    const hashed = await bcrypt.hash(password, 10);
    const existing = await userModel.findOne({ email });
    if (!existing) await userModel.create({ name: "Masala Hub", email, password: hashed, role: "admin" });
  }
}

export function lineKey(itemId, variantIds = [], extraIds = []) {
  return [itemId, ...[...variantIds].sort(), ...[...extraIds].sort()].join("|");
}
