import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { createUser, findUserByEmail, getUserById } from "../models/users.js";

const PASSWORD_MIN = 6;

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function register(req, res, next) {
  try {
    const { name, email, phone, password, role } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    if (password.length < PASSWORD_MIN) {
      res
        .status(400)
        .json({ error: `Password must be at least ${PASSWORD_MIN} characters` });
      return;
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    let normalizedRole = "client";
    let normalizedStatus = "approved";

    if (role === "admin") {
      res.status(403).json({
        error: "Admin registration is restricted",
      });
      return;
    }

    if (role === "owner") {
      res.status(403).json({
        error: "Property owner registration is admin-only",
      });
      return;
    }

    const userId = await createUser({
      role: normalizedRole,
      status: normalizedStatus,
      name,
      email,
      phone,
      passwordHash,
    });
    const token = signToken({
      id: userId,
      role: normalizedRole,
      status: normalizedStatus,
      email,
    });
    res.status(201).json({
      token,
      user: {
        id: userId,
        role: normalizedRole,
        status: normalizedStatus,
        name,
        email,
        phone,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        status: user.status,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
