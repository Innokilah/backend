import dotenv from "dotenv";

dotenv.config();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseCorsOrigins(value) {
  if (!value) return "*";
  const origins = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins.length === 0) return "*";
  return origins;
}

export const env = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN || "",
  },
  firebase: {
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || "",
    credentialPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  },
  paychangu: {
    baseUrl: process.env.PAYCHANGU_BASE_URL || "https://api.paychangu.com",
    secretKey: process.env.PAYCHANGU_SECRET_KEY || "",
    webhookSecret: process.env.PAYCHANGU_WEBHOOK_SECRET || "",
    callbackUrl: process.env.PAYCHANGU_CALLBACK_URL || "",
    returnUrl: process.env.PAYCHANGU_RETURN_URL || "",
    mockMode: parseBoolean(process.env.PAYCHANGU_MOCK_MODE, false),
  },
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "erhanive",
  },
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
};
