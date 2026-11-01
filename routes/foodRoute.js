import express from "express";
import {
  addFood,
  availability,
  extras,
  foodItem,
  importFood,
  listFood,
  recommend,
  removeExtra,
  removeFood,
  report,
  resolve,
  reviewAdmin,
  reviews,
  addReview,
  moderate,
  saveSettings,
  settings,
  updateFood,
  upsertExtra,
} from "../controllers/foodController.js";
import { uploadOptional } from "../middleware/uploadCloudinary.js";
import adminAuth from "../middleware/adminAuth.js";
import authMiddleware from "../middleware/auth.js";

const foodRouter = express.Router();

foodRouter.post("/add", adminAuth, uploadOptional, addFood);
foodRouter.post("/update", adminAuth, uploadOptional, updateFood);
foodRouter.post("/update/:id", adminAuth, uploadOptional, updateFood);
foodRouter.get("/list", listFood);
foodRouter.post("/remove", adminAuth, removeFood);
foodRouter.delete("/remove/:id", adminAuth, removeFood);
foodRouter.get("/item/:slug", foodItem);
foodRouter.get("/recommendations", recommend);
foodRouter.get("/reviews/admin", adminAuth, reviewAdmin);
foodRouter.post("/reviews/report", authMiddleware, report);
foodRouter.patch("/reviews/reports/:id", adminAuth, resolve);
foodRouter.get("/reviews", reviews);
foodRouter.post("/reviews", authMiddleware, addReview);
foodRouter.patch("/reviews/:id", adminAuth, moderate);
foodRouter.get("/extras", extras);
foodRouter.post("/extras", adminAuth, upsertExtra);
foodRouter.delete("/extras/:id", adminAuth, removeExtra);
foodRouter.get("/settings", adminAuth, settings);
foodRouter.put("/settings", adminAuth, saveSettings);
foodRouter.post("/settings", adminAuth, saveSettings);
foodRouter.get("/availability", availability);
foodRouter.post("/import", adminAuth, importFood);

export default foodRouter;
