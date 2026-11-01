import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { readToken } from "../middleware/auth.js";
import { publicUser, registerCustomer, updateProfile } from "../services/store.js";

function fail(res, code, status = 400) {
  return res.status(status).json({ success: false, error: code, message: code });
}

const createToken = (id) => {
  const secret = process.env.JWT_SECRET || "dev_fallback_jwt_secret_change_me";
  return jwt.sign({ id }, secret, { expiresIn: "7d" });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email: String(email || "").trim().toLowerCase() });
    if (!user) return fail(res, "credentials", 401);
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return fail(res, "credentials", 401);
    const token = createToken(user._id);
    return res.json({ success: true, token, role: user.role === "admin" ? "admin" : "customer", user: publicUser(user) });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const registerUser = async (req, res) => {
  try {
    const role = req.body.role === "admin" ? "admin" : "user";
    const result = await registerCustomer({ name: req.body.name, email: req.body.email, password: req.body.password, role });
    if (!result.ok) return fail(res, result.code, result.code === "email_taken" ? 409 : 400);
    const token = createToken(result.user._id);
    return res.status(201).json({ success: true, token, role: publicUser(result.user).role, user: publicUser(result.user) });
  } catch (error) {
    console.log(error);
    return fail(res, "generic");
  }
};

const me = async (req, res) => {
  const userId = readToken(req);
  if (!userId) return res.json({ success: true, user: null });
  const user = await userModel.findById(userId);
  return res.json({ success: true, user: publicUser(user) });
};

const profile = async (req, res) => {
  const result = await updateProfile(req.body.userId, req.body);
  if (!result.ok) return fail(res, result.code);
  return res.json({ success: true, user: result.user });
};

const logoutUser = async (req, res) => {
  return res.json({ success: true });
};

export { loginUser, registerUser, me, profile, logoutUser };
