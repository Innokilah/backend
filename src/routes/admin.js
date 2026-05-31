import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  createAdminListing,
  getAdminListings,
  updateAdminListing,
  getOwnerUsers,
  updateOwnerStatus,
  createOwnerUser,
  deleteOwnerUser,
  deleteAdminListing,
  getAdminPayments,
  getAdminSupportThreads,
  getAdminSupportMessages,
  postAdminSupportMessage,
  sendAdminTestPush,
} from "../controllers/adminController.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/listings", getAdminListings);
router.post("/listings", createAdminListing);
router.patch("/listings/:id", updateAdminListing);
router.delete("/listings/:id", deleteAdminListing);
router.get("/owners", getOwnerUsers);
router.patch("/owners/:id", updateOwnerStatus);
router.post("/owners", createOwnerUser);
router.delete("/owners/:id", deleteOwnerUser);
router.get("/payments", getAdminPayments);
router.post("/test-push", sendAdminTestPush);
router.get("/support/threads", getAdminSupportThreads);
router.get("/support/threads/:id/messages", getAdminSupportMessages);
router.post("/support/threads/:id/messages", postAdminSupportMessage);

export default router;
