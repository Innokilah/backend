import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getMyNotifications,
  postNotification,
  patchNotificationRead,
} from "../controllers/notificationsController.js";

const router = Router();

router.get("/", requireAuth, getMyNotifications);
router.post("/", requireAuth, postNotification);
router.patch("/:id/read", requireAuth, patchNotificationRead);

export default router;
