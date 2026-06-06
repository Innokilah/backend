import {
  createNotification,
  listNotificationsForUser,
  markNotificationRead,
} from "../models/notifications.js";

function normalizeNotificationType(value) {
  const normalized = String(value || "local").trim().toLowerCase();
  if (normalized === "push") return "push";
  return "local";
}

export async function postNotification(req, res, next) {
  try {
    const { title, body, type, data } = req.body || {};
    if (!title && !body) {
      res.status(400).json({ error: "Title or body is required" });
      return;
    }

    const notification = await createNotification({
      userId: req.user.id,
      title: String(title || "").trim(),
      body: String(body || "").trim(),
      notificationType: normalizeNotificationType(type),
      data: data && typeof data === "object" ? data : null,
    });

    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
}

export async function getMyNotifications(req, res, next) {
  try {
    const notifications = await listNotificationsForUser(req.user.id);
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

export async function patchNotificationRead(req, res, next) {
  try {
    const notificationId = Number(req.params.id);
    if (!Number.isFinite(notificationId)) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    const ok = await markNotificationRead(notificationId, req.user.id);
    if (!ok) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
