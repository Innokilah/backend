import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  handlePayChanguWebhook,
  initializeConnectionFee,
  initializeListingSubmissionFee,
  payChanguCallback,
  payChanguReturn,
  verifyConnectionFee,
  verifyListingSubmissionFee,
} from "../controllers/paymentsController.js";

const router = Router();

router.post("/connection-fee/initialize", requireAuth, initializeConnectionFee);
router.post("/connection-fee/verify", requireAuth, verifyConnectionFee);
router.post(
  "/listing-submission/initialize",
  requireAuth,
  initializeListingSubmissionFee
);
router.post(
  "/listing-submission/verify",
  requireAuth,
  verifyListingSubmissionFee
);
router.post("/paychangu/webhook", handlePayChanguWebhook);
router.get("/paychangu/callback", payChanguCallback);
router.get("/paychangu/return", payChanguReturn);

export default router;
