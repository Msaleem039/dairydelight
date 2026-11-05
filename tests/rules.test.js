import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCoupon, orderingDecision, recommendProducts, reviewEligibility, DEFAULT_SETTINGS } from "../lib/rules.js";

test("closed hours block immediate orders", () => {
  const settings = { ...DEFAULT_SETTINGS, hours: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } };
  const decision = orderingDecision(new Date("2026-10-29T12:00:00Z"), settings, [], "pickup", null);
  assert.equal(decision.ok, false);
  assert.equal(decision.code, "closed");
});

test("takeaway can book a pickup time without turning on scheduled delivery", () => {
  const now = new Date("2026-06-15T10:00:00Z");
  const settings = { ...DEFAULT_SETTINGS, allowScheduled: false };
  const pickup = orderingDecision(now, settings, [], "pickup", { date: "2026-06-15", time: "14:00" });
  assert.equal(pickup.ok, true);
  const delivery = orderingDecision(now, settings, [], "delivery", { date: "2026-06-15", time: "14:00" });
  assert.equal(delivery.ok, false);
  assert.equal(delivery.code, "schedule_disabled");
});

test("expired coupons are rejected", () => {
  const result = evaluateCoupon(
    {
      code: "OLD",
      type: "percent",
      value: 10,
      minSubtotalCents: 0,
      expiresAt: "2020-01-01T00:00:00.000Z",
      startsAt: null,
      usageLimit: null,
      usedCount: 0,
      perUserLimit: 1,
      userRedemptions: 0,
      active: true,
    },
    1000,
    new Date("2026-10-29T12:00:00Z"),
  );
  assert.equal(result.code, "coupon_expired");
});

test("reviews require the customer and a completed order", () => {
  const denied = reviewEligibility({
    actorUserId: "a",
    orderUserId: "b",
    fulfillmentStatus: "completed",
    paymentStatus: "paid",
    itemProductId: "sp-1",
    requestedProductId: "sp-1",
    orderItemId: "line",
    alreadyReviewed: false,
  });
  assert.equal(denied.code, "review_forbidden");
  const pending = reviewEligibility({
    actorUserId: "a",
    orderUserId: "a",
    fulfillmentStatus: "pending",
    paymentStatus: "paid",
    itemProductId: "sp-1",
    requestedProductId: "sp-1",
    orderItemId: "line",
    alreadyReviewed: false,
  });
  assert.equal(pending.code, "review_not_completed");
});

test("recommendations stay with complementary dishes", () => {
  const ids = recommendProducts({
    anchors: [{ id: "burger", category: "pizzas" }],
    catalog: [
      { id: "burger", category: "pizzas", available: true, name: "Pizza" },
      { id: "drink", category: "boissons", available: true, name: "Lassi" },
      { id: "gone", category: "boissons", available: false, name: "Off" },
    ],
    complements: [{ category: "pizzas", complement: "boissons" }],
    explicit: [],
    excludeIds: ["burger"],
    limit: 4,
  });
  assert.deepEqual(ids, ["drink"]);
});
