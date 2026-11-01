import { readToken } from "../middleware/auth.js";
import foodModel from "../models/foodModel.js";
import cloudinary from "../middleware/cloudinary.js";
import {
  adminReviews,
  createReview,
  deleteExtra,
  deleteProduct,
  importLegacy,
  listExtras,
  listProducts,
  listPublicReviews,
  moderateReview,
  productBySlug,
  publicInfo,
  recommendations,
  reportReview,
  resolveReport,
  saveExtra,
  saveProduct,
  saveRestaurantSettings,
} from "../services/store.js";
import { readSettings } from "../services/store.js";

function fail(res, code, status = 400) {
  return res.status(status).json({ success: false, error: code, message: code });
}

const addFood = async (req, res) => {
  try {
    const image = req.cloudinaryResult?.secure_url || req.body.image;
    const result = await saveProduct({ ...req.body, image, id: req.body.id || req.body.code });
    if (!result.ok) return fail(res, result.code);
    return res.json({ success: true, message: "Food Added", product: result.product });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const updateFood = async (req, res) => {
  const image = req.cloudinaryResult?.secure_url || req.body.image;
  const result = await saveProduct({ ...req.body, image, id: req.params.id || req.body.id });
  if (!result.ok) return fail(res, result.code);
  return res.json({ success: true, message: "Food Updated", product: result.product });
};

const listFood = async (req, res) => {
  try {
    const products = await listProducts();
    const extras = await listExtras();
    const info = await publicInfo();
    return res.json({ success: true, data: products, products, extras, info });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const foodItem = async (req, res) => {
  const product = await productBySlug(decodeURIComponent(req.params.slug));
  if (!product) return fail(res, "not_found", 404);
  const related = await recommendations([product.id], 3);
  return res.json({ success: true, product, related });
};

const recommend = async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const products = await recommendations(ids, 4);
  return res.json({ success: true, products });
};

const reviews = async (req, res) => {
  const result = await listPublicReviews(
    {
      productId: req.query.productId,
      sort: req.query.sort,
      page: req.query.page,
      pageSize: req.query.pageSize,
    },
    readToken(req),
  );
  return res.json({ success: true, ...result });
};

const addReview = async (req, res) => {
  if (!req.body.userId) return fail(res, "review_forbidden", 401);
  const result = await createReview(req.body.userId, req.body);
  if (!result.ok) return fail(res, result.code, 403);
  return res.status(201).json({ success: true, id: result.id });
};

const report = async (req, res) => {
  if (!req.body.userId) return fail(res, "forbidden", 401);
  const result = await reportReview(req.body.userId, req.body.reviewId || req.params.id, req.body.reason);
  if (!result.ok) return fail(res, result.code, 404);
  return res.json({ success: true });
};

const moderate = async (req, res) => {
  const result = await moderateReview(req.params.id, req.body.status);
  if (!result.ok) return fail(res, result.code, result.code === "not_found" ? 404 : 400);
  return res.json({ success: true });
};

const reviewAdmin = async (req, res) => {
  return res.json({ success: true, ...(await adminReviews()) });
};

const resolve = async (req, res) => {
  await resolveReport(req.params.id);
  return res.json({ success: true });
};

const extras = async (req, res) => {
  return res.json({ success: true, extras: await listExtras() });
};

const upsertExtra = async (req, res) => {
  const result = await saveExtra(req.body ?? {});
  if (!result.ok) return fail(res, result.code);
  return res.json({ success: true, extras: result.extras });
};

const removeExtra = async (req, res) => {
  await deleteExtra(req.params.id);
  return res.json({ success: true });
};

const settings = async (req, res) => {
  const info = await publicInfo();
  const stored = await readSettings();
  return res.json({ success: true, info, complements: stored.complements });
};

const saveSettings = async (req, res) => {
  const result = await saveRestaurantSettings(req.body ?? {});
  if (!result.ok) return fail(res, result.code);
  return res.json({ success: true, info: result.info, complements: result.complements });
};

const availability = async (req, res) => {
  return res.json({ success: true, ...(await publicInfo()) });
};

const importFood = async (req, res) => {
  const result = await importLegacy(req.body ?? {});
  return res.json({ success: true, ...result });
};

const removeFood = async (req, res) => {
  try {
    const id = req.body.id || req.params.id;
    const food = await foodModel.findOne({ $or: [{ code: id }, { _id: id }] }).catch(() => foodModel.findOne({ code: id }));
    if (food?.image && food.image.includes("res.cloudinary.com")) {
      try {
        const match = food.image.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        if (match?.[1]) await cloudinary.uploader.destroy(match[1]);
      } catch (cloudinaryError) {
        console.log("Error deleting from Cloudinary:", cloudinaryError);
      }
    }
    const removed = await deleteProduct(id);
    if (!removed) return fail(res, "not_found", 404);
    return res.json({ success: true, message: "Food Removed" });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

export {
  addFood,
  updateFood,
  listFood,
  removeFood,
  foodItem,
  recommend,
  reviews,
  addReview,
  report,
  moderate,
  reviewAdmin,
  resolve,
  extras,
  upsertExtra,
  removeExtra,
  settings,
  saveSettings,
  availability,
  importFood,
};
