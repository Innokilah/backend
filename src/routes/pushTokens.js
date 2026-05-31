import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  registerPushToken,
  unregisterPushToken,
} from "../controllers/pushTokensController.js";

const router = Router();

router.post("/", requireAuth, registerPushToken);
router.delete("/", requireAuth, unregisterPushToken);

export default router;
