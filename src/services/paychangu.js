import crypto from "crypto";
import { env } from "../config/env.js";

function getBaseUrl() {
  return String(env.paychangu.baseUrl || "https://api.paychangu.com").replace(
    /\/+$/,
    ""
  );
}

function getAuthHeaders() {
  if (!env.paychangu.secretKey) {
    throw new Error("PAYCHANGU_SECRET_KEY is not configured");
  }

  return {
    Accept: "application/json",
    Authorization: `Bearer ${env.paychangu.secretKey}`,
  };
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function createHostedCheckout(payload) {
  const response = await fetch(`${getBaseUrl()}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to initialize PayChangu checkout");
  }

  return data;
}

export async function verifyPayChanguTransaction(txRef) {
  if (!txRef) {
    throw new Error("Transaction reference is required");
  }

  const response = await fetch(
    `${getBaseUrl()}/verify-payment/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    }
  );

  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(data?.message || "Failed to verify PayChangu payment");
  }

  return data;
}

export function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!env.paychangu.webhookSecret || !rawBody || !signatureHeader) {
    return false;
  }

  const computedSignature = crypto
    .createHmac("sha256", env.paychangu.webhookSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedSignature, "utf8"),
      Buffer.from(String(signatureHeader), "utf8")
    );
  } catch {
    return false;
  }
}
