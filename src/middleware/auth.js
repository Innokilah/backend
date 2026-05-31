import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    req.user = null;
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
  } catch (_error) {
    req.user = null;
  }

  next();
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireApprovedOwner(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "owner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (req.user.status !== "approved") {
    res.status(403).json({ error: "Owner not approved" });
    return;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
