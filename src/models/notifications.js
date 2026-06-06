import { getPool } from "../db.js";

export async function createNotification({
  userId,
  title,
  body,
  notificationType,
  data,
  isRead = false,
}) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO notifications
      (user_id, title, body, notification_type, data, is_read)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      title,
      body,
      notificationType,
      data ? JSON.stringify(data) : null,
      isRead ? 1 : 0,
    ]
  );

  const [[notification]] = await pool.execute(
    `SELECT * FROM notifications WHERE id = ? LIMIT 1`,
    [result.insertId]
  );

  return notification || null;
}

export async function listNotificationsForUser(userId, limit = 100) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT * FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, Number(limit) || 100]
  );
  return rows.map((row) => ({
    ...row,
    data: row.data ? JSON.parse(row.data) : null,
  }));
}

export async function markNotificationRead(notificationId, userId) {
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE notifications
     SET is_read = 1
     WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}
