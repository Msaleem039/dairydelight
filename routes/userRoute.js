import express from "express";
import { loginUser, logoutUser, me, profile, registerUser } from "../controllers/userController.js";
import authMiddleware from "../middleware/auth.js";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/login", loginUser);
userRouter.get("/me", me);
userRouter.patch("/me", authMiddleware, profile);
userRouter.post("/logout", logoutUser);

export default userRouter;
