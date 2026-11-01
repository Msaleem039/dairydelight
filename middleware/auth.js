import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_SECRET || "dev_fallback_jwt_secret_change_me";

export function readToken(req) {
  let token = req.headers.token;
  if (!token && req.headers.authorization?.startsWith("Bearer ")) token = req.headers.authorization.slice(7);
  if (!token) return null;
  try {
    return jwt.verify(token, secret()).id;
  } catch {
    return null;
  }
}

const authMiddleware = async (req, res, next) => {
  const userId = readToken(req);
  if (!userId) return res.status(401).json({ success: false, error: "forbidden", message: "Not Authorized, login again" });
  req.body = req.body || {};
  req.body.userId = userId;
  next();
};

export default authMiddleware;