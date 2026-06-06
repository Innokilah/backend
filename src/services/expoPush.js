import admin from "firebase-admin";
import { env } from "../config/env.js";
import {
  deactivatePushTokensByTokens,
  listActivePushTokensForRole,
  listActivePushTokensForUsers,
} from "../models/pushTokens.js";

function initFirebaseApp() {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccountString = String(env.firebase.serviceAccount || "").trim();
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid JSON");
    }
  }

  if (env.firebase.credentialPath) {
    return admin.initializeApp();
  }

  throw new Error(
    "Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

const firebaseApp = initFirebaseApp();

function dedupeTokens(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const token = String(row?.expo_push_token || "").trim();
    if (!token || seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

function normalizeData(messageData = {}) {
  const result = {};
  Object.entries(messageData || {}).forEach(([key, value]) => {
    const normalized =
      value === undefined || value === null ? "" : String(value);
    result[key] = normalized;
  });
  return result;
}

async function sendToRows(rows, payload) {
  const activeRows = dedupeTokens(rows);
  if (activeRows.length === 0) return { sent: 0 };

  const tokens = activeRows.map((row) => String(row.expo_push_token).trim());
  const message = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: normalizeData(payload.data),
    android: {
      priority: "high",
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
    },
  };

  const response = await admin.messaging(firebaseApp).sendMulticast(message);
  const invalidTokens = [];

  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await deactivatePushTokensByTokens(invalidTokens);
  }

  return { sent: response.successCount, invalidated: invalidTokens.length };
}

export async function sendPushToUsers(userIds, payload) {
  const rows = await listActivePushTokensForUsers(userIds);
  return sendToRows(rows, payload);
}

export async function sendPushToRole(role, payload) {
  const rows = await listActivePushTokensForRole(role);
  return sendToRows(rows, payload);
}
