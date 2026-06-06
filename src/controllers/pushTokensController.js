import {
  deactivatePushToken,
  upsertPushToken,
} from "../models/pushTokens.js";

function isValidPushToken(value) {
  return typeof value === "string" && String(value || "").trim().length > 0;
}

export async function registerPushToken(req, res, next) {
  try {
    const { expoPushToken, deviceId, platform } = req.body || {};
    if (!isValidPushToken(expoPushToken)) {
      res.status(400).json({ error: "A valid push token is required" });
      return;
    }

    const item = await upsertPushToken({
      userId: req.user.id,
      expoPushToken: String(expoPushToken).trim(),
      deviceId: deviceId ? String(deviceId).trim() : null,
      platform,
    });

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
}

export async function unregisterPushToken(req, res, next) {
  try {
    const { expoPushToken, deviceId } = req.body || {};
    const ok = await deactivatePushToken({
      userId: req.user.id,
      expoPushToken: expoPushToken ? String(expoPushToken).trim() : null,
      deviceId: deviceId ? String(deviceId).trim() : null,
    });
    res.json({ ok });
  } catch (error) {
    next(error);
  }
}
