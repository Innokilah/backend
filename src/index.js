import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { healthCheck } from "./db.js";
import { ensureAppSchema } from "./bootstrap/schema.js";
import healthRoutes from "./routes/health.js";
import listingsRoutes from "./routes/listings.js";
import ownerRoutes from "./routes/owner.js";
import adminRoutes from "./routes/admin.js";
import uploadsRoutes from "./routes/uploads.js";
import authRoutes from "./routes/auth.js";
import messagesRoutes from "./routes/messages.js";
import paymentsRoutes from "./routes/payments.js";
import pushTokensRoutes from "./routes/pushTokens.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigin === "*") {
        callback(null, true);
        return;
      }
      const isAllowed = Array.isArray(env.corsOrigin)
        ? env.corsOrigin.includes(origin)
        : origin === env.corsOrigin;
      callback(isAllowed ? null : new Error("Not allowed by CORS"), isAllowed);
    },
  })
);
app.use(
  express.json({
    verify(req, _res, buf) {
      req.rawBody = buf?.length ? buf.toString("utf8") : "";
    },
  })
);

app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.use("/api/health", healthRoutes);
app.use("/api/listings", listingsRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/push-tokens", pushTokensRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err?.statusCode || 500).json({
    error: err?.message || "Server error",
  });
});

app.listen(env.port, async () => {
  try {
    await ensureAppSchema();
    await healthCheck();
    console.log(`API running on port ${env.port}`);
  } catch (error) {
    console.warn("Database connection failed", error.message);
  }
});
