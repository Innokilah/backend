import { Router } from "express";
import {
  createOwnerListing,
  deleteOwnerListingById,
  getOwnerListings,
  updateOwnerProfile,
  updateOwnerListingById,
} from "../controllers/ownerController.js";
import { requireAuth, requireApprovedOwner } from "../middleware/auth.js";

const router = Router();

// Create listing (owner submission)
router.post("/listings", requireAuth, requireApprovedOwner, createOwnerListing);

// Owner listings
router.get("/listings", requireAuth, requireApprovedOwner, getOwnerListings);

// Owner profile
router.patch("/profile", requireAuth, requireApprovedOwner, updateOwnerProfile);

// Update listing
router.patch(
  "/listings/:id",
  requireAuth,
  requireApprovedOwner,
  updateOwnerListingById
);

// Delete listing
router.delete(
  "/listings/:id",
  requireAuth,
  requireApprovedOwner,
  deleteOwnerListingById
);

export default router;
