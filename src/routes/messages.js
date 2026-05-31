import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getMyThreads,
  getThreadMessages,
  postThreadMessage,
  startOwnerContactThread,
  startSupportThread,
} from "../controllers/messagesController.js";

const router = Router();

router.get("/threads", requireAuth, getMyThreads);
router.post("/threads/owner-contact", requireAuth, startOwnerContactThread);
router.post("/threads/support", requireAuth, startSupportThread);
router.get("/threads/:id/messages", requireAuth, getThreadMessages);
router.post("/threads/:id/messages", requireAuth, postThreadMessage);

export default router;
