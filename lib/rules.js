export const FULFILLMENT_STATUSES = ["pending", "confirmed", "preparing", "ready", "on_the_way", "completed", "cancelled"];

export const DEFAULT_SETTINGS = {
  timezone: "Europe/Paris",
  hours: {
    0: [{ open: "11:00", close: "23:00" }],
    1: [{ open: "11:00", close: "23:00" }],
    2: [{ open: "11:00", close: "23:00" }],
    3: [{ open: "11:00", close: "23:00" }],
    4: [{ open: "11:00", close: "23:00" }],
    5: [{ open: "11:00", close: "23:00" }],
    6: [{ open: "11:00", close: "23:00" }],
  },
  deliveryEnabled: true,
  pickupEnabled: true,
  minOrderCents: 0,
  deliveryFeeCents: 290,
  freeDeliveryFromCents: 2500,
  prepMinutes: 25,
  vatRate: 10,
  allowScheduled: false,
};

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function eurosToCents(value) {
  return Math.round(Number(value) * 100);
}

export function centsToEuros(cents) {
  return cents / 100;
}

export function includedVatCents(ttcCents, vatRate) {
  if (vatRate <= 0 || ttcCents <= 0) return 0;
  return Math.round((ttcCents * vatRate) / (100 + vatRate));
}

export function sanitizeText(value, max) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function allergenText(value) {
  const text = sanitizeText(value, 500);
  if (/sans allerg|allergen[-\s]?free|aucun allerg|free from all|allergène[-\s]?free/i.test(text)) {
    return { ok: false, code: "allergen_claim" };
  }
  return { ok: true, value: text };
}

export function parseHHMM(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    weekday: WEEKDAY[bag.weekday] ?? 0,
    date: `${bag.year}-${bag.month}-${bag.day}`,
    minutes: hour * 60 + Number(bag.minute),
  };
}

export function wallTimeToUtc(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseHHMM(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    const wanted = Date.parse(`${date}T00:00:00Z`);
    const actual = Date.parse(`${parts.date}T00:00:00Z`);
    const dayDelta = Math.round((wanted - actual) / 86400000);
    const minuteDelta = hour * 60 + minute - parts.minutes;
    if (dayDelta === 0 && minuteDelta === 0) return new Date(utc);
    utc += dayDelta * 86400000 + minuteDelta * 60000;
  }
  const check = zonedParts(new Date(utc), timeZone);
  if (check.date === date && check.minutes === hour * 60 + minute) return new Date(utc);
  return null;
}

export function isOpenAt(date, settings, closures, service) {
  if (service === "delivery" && !settings.deliveryEnabled) return false;
  if (service === "pickup" && !settings.pickupEnabled) return false;
  const parts = zonedParts(date, settings.timezone);
  const closed = closures.some((closure) => closure.date === parts.date && (closure.service === "both" || closure.service === service));
  if (closed) return false;
  const windows = settings.hours[String(parts.weekday)] ?? [];
  return windows.some((window) => {
    const open = parseHHMM(window.open);
    const close = parseHHMM(window.close);
    if (open === null || close === null || open === close) return false;
    if (close > open) return parts.minutes >= open && parts.minutes < close;
    return parts.minutes >= open || parts.minutes < close;
  });
}

export function nextOpening(from, settings, closures, service) {
  const step = 10 * 60000;
  for (let offset = step; offset <= 8 * 86400000; offset += step) {
    const when = new Date(from.getTime() + offset);
    if (isOpenAt(when, settings, closures, service)) return when.toISOString();
  }
  return null;
}

export function hoursShort(settings) {
  const signatures = new Set();
  for (let day = 0; day < 7; day += 1) {
    const windows = settings.hours[String(day)] ?? [];
    if (windows.length === 0) return "";
    signatures.add(windows.map((window) => `${window.open}-${window.close}`).join(","));
  }
  if (signatures.size !== 1) return "";
  const [first] = settings.hours["1"] ?? [];
  if (!first) return "";
  return `${first.open} — ${first.close}`;
}

export function orderingDecision(now, settings, closures, service, scheduled) {
  if (service === "delivery" && !settings.deliveryEnabled) return { ok: false, code: "delivery_off" };
  if (service === "pickup" && !settings.pickupEnabled) return { ok: false, code: "pickup_off" };
  const openNow = isOpenAt(now, settings, closures, service);
  if (!scheduled) {
    if (openNow) return { ok: true, scheduledFor: null };
    return { ok: false, code: "closed", nextOpenAt: nextOpening(now, settings, closures, service) };
  }
  if (!settings.allowScheduled && service !== "pickup") return { ok: false, code: "schedule_disabled" };
  const when = wallTimeToUtc(scheduled.date, scheduled.time, settings.timezone);
  if (!when) return { ok: false, code: "bad_schedule" };
  if (when.getTime() < now.getTime() + settings.prepMinutes * 60000) return { ok: false, code: "too_soon" };
  if (when.getTime() > now.getTime() + 7 * 86400000) return { ok: false, code: "too_far" };
  if (!isOpenAt(when, settings, closures, service)) return { ok: false, code: "slot_closed" };
  return { ok: true, scheduledFor: when.toISOString() };
}

export function evaluateCoupon(coupon, subtotalCents, now) {
  if (!coupon) return { ok: false, discountCents: 0, code: "coupon_unknown" };
  if (!coupon.active) return { ok: false, discountCents: 0, code: "coupon_inactive" };
  if (coupon.startsAt && now.getTime() < new Date(coupon.startsAt).getTime()) return { ok: false, discountCents: 0, code: "coupon_early" };
  if (coupon.expiresAt && now.getTime() > new Date(coupon.expiresAt).getTime()) return { ok: false, discountCents: 0, code: "coupon_expired" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return { ok: false, discountCents: 0, code: "coupon_limit" };
  if (coupon.userRedemptions >= coupon.perUserLimit) return { ok: false, discountCents: 0, code: "coupon_user_limit" };
  if (subtotalCents < coupon.minSubtotalCents) return { ok: false, discountCents: 0, code: "coupon_minimum" };
  const raw = coupon.type === "percent" ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  const discountCents = Math.min(subtotalCents, Math.max(0, raw));
  return { ok: true, discountCents, code: "coupon_applied" };
}

export function deliveryFeeCents(subtotalCents, settings, service) {
  if (service === "pickup" || subtotalCents <= 0) return 0;
  if (subtotalCents >= settings.freeDeliveryFromCents) return 0;
  return settings.deliveryFeeCents;
}

export function recommendProducts(input) {
  const excluded = new Set(input.excludeIds);
  const anchorIds = new Set(input.anchors.map((anchor) => anchor.id));
  const scores = new Map();
  const bump = (id, amount) => scores.set(id, (scores.get(id) ?? 0) + amount);
  for (const anchor of input.anchors) {
    for (const link of input.explicit) {
      if (link.productId === anchor.id) bump(link.relatedId, 50);
    }
    for (const pair of input.complements) {
      if (pair.category !== anchor.category) continue;
      for (const item of input.catalog) {
        if (item.category === pair.complement) bump(item.id, 20);
      }
    }
    for (const item of input.catalog) {
      if (item.category === anchor.category) bump(item.id, 5);
    }
  }
  return [...scores.entries()]
    .filter(([id]) => !excluded.has(id) && !anchorIds.has(id))
    .map(([id, score]) => ({ item: input.catalog.find((entry) => entry.id === id), score }))
    .filter((entry) => entry.item?.available)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .filter((entry, index, list) => list.findIndex((other) => other.item.id === entry.item.id) === index)
    .slice(0, input.limit)
    .map((entry) => entry.item.id);
}

export function reviewEligibility(input) {
  if (!input.actorUserId || input.orderUserId !== input.actorUserId) return { ok: false, code: "review_forbidden" };
  if (input.fulfillmentStatus !== "completed") return { ok: false, code: "review_not_completed" };
  if (input.itemProductId !== input.requestedProductId) return { ok: false, code: "review_product" };
  if (input.alreadyReviewed) return { ok: false, code: "review_duplicate" };
  return { ok: true };
}

export function normalizeFulfillment(status) {
  if (status === "delivered" || status === "completed") return "completed";
  if (status === "shipped") return "on_the_way";
  if (FULFILLMENT_STATUSES.includes(status)) return status;
  return "pending";
}

export function publicAuthor(name) {
  const first = sanitizeText(name, 80).split(/\s+/)[0] ?? "";
  return first || "Client";
}

export function phoneDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function dishSlug(dish) {
  if (dish.slug) return dish.slug;
  const base = String(dish.name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || String(dish.id || dish._id || "plat");
}
