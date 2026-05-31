import { getPool } from "../db.js";

function normalizePlatform(platform) {
  const value = String(platform || "").trim().toLowerCase();
  if (["ios", "android", "web"].includes(value)) return value;
  return "unknown";
}

export async function upsertPushToken({
  userId,
  expoPushToken,
  deviceId,
  platform,
}) {
  const pool = getPool();
  const normalizedPlatform = normalizePlatform(platform);
  const normalizedDeviceId = deviceId ? String(deviceId).trim() : null;

  await pool.execute(
    `INSERT INTO push_tokens
      (user_id, expo_push_token, device_id, platform, is_active, last_seen_at)
     VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      device_id = VALUES(device_id),
      platform = VALUES(platform),
      is_active = 1,
      last_seen_at = CURRENT_TIMESTAMP`,
    [userId, expoPushToken, normalizedDeviceId, normalizedPlatform]
  );

  const [[token]] = await pool.execute(
    `SELECT *
     FROM push_tokens
     WHERE expo_push_token = ?
     LIMIT 1`,
    [expoPushToken]
  );
  return token || null;
}

export async function deactivatePushToken({ userId, expoPushToken, deviceId }) {
  const pool = getPool();
  const conditions = ["user_id = ?"];
  const values = [userId];

  if (expoPushToken) {
    conditions.push("expo_push_token = ?");
    values.push(expoPushToken);
  } else if (deviceId) {
    conditions.push("device_id = ?");
    values.push(deviceId);
  } else {
    return false;
  }

  const [result] = await pool.execute(
    `UPDATE push_tokens
     SET is_active = 0
     WHERE ${conditions.join(" AND ")}`,
    values
  );
  return result.affectedRows > 0;
}

export async function deactivatePushTokensByTokens(tokens = []) {
  const normalized = [...new Set(tokens.filter(Boolean))];
  if (normalized.length === 0) return;

  const pool = getPool();
  const placeholders = normalized.map(() => "?").join(", ");
  await pool.execute(
    `UPDATE push_tokens
     SET is_active = 0
     WHERE expo_push_token IN (${placeholders})`,
    normalized
  );
}

export async function listActivePushTokensForUsers(userIds = []) {
  const normalized = [...new Set(userIds.map(Number).filter(Boolean))];
  if (normalized.length === 0) return [];

  const pool = getPool();
  const placeholders = normalized.map(() => "?").join(", ");
  const [rows] = await pool.execute(
    `SELECT *
     FROM push_tokens
     WHERE is_active = 1
       AND user_id IN (${placeholders})`,
    normalized
  );
  return rows;
}

export async function listActivePushTokensForRole(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT pt.*
     FROM push_tokens pt
     INNER JOIN users u ON u.id = pt.user_id
     WHERE pt.is_active = 1
       AND u.role = ?`,
    [role]
  );
  return rows;
}
