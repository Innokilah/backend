import { env } from "../config/env.js";
import {
  deactivatePushTokensByTokens,
  listActivePushTokensForRole,
  listActivePushTokensForUsers,
} from "../models/pushTokens.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(value) {
  return /^ExponentPushToken\[.+\]$/.test(String(value || "")) ||
    /^ExpoPushToken\[.+\]$/.test(String(value || ""));
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function dedupeTokens(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const token = String(row?.expo_push_token || "");
    if (!token || seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

async function postExpoMessages(messages) {
  if (messages.length === 0) return [];

  const headers = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };

  if (env.expo.accessToken) {
    headers.Authorization = `Bearer ${env.expo.accessToken}`;
  }

  const results = [];
  for (const batch of chunk(messages, 100)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.errors?.[0]?.message || "Expo push request failed");
    }
    const items = Array.isArray(data?.data) ? data.data : [];
    results.push(...items);
  }
  return results;
}

async function sendToRows(rows, payload) {
  const activeRows = dedupeTokens(rows).filter((row) =>
    isExpoPushToken(row.expo_push_token)
  );
  if (activeRows.length === 0) return { sent: 0 };

  const messages = activeRows.map((row) => ({
    to: row.expo_push_token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    channelId: payload.channelId || "default",
  }));

  const receipts = await postExpoMessages(messages);
  const invalidTokens = [];

  receipts.forEach((receipt, index) => {
    if (
      receipt?.status === "error" &&
      receipt?.details?.error === "DeviceNotRegistered"
    ) {
      invalidTokens.push(activeRows[index]?.expo_push_token);
    }
  });

  if (invalidTokens.length > 0) {
    await deactivatePushTokensByTokens(invalidTokens);
  }

  return { sent: messages.length, invalidated: invalidTokens.length };
}

export async function sendPushToUsers(userIds, payload) {
  const rows = await listActivePushTokensForUsers(userIds);
  return sendToRows(rows, payload);
}

export async function sendPushToRole(role, payload) {
  const rows = await listActivePushTokensForRole(role);
  return sendToRows(rows, payload);
}
