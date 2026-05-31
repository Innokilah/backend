import { Router } from "express";
import { getListing, getPublicListings } from "../controllers/listingsController.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

// Public listings (approved)
router.get("/", getPublicListings);

// Listing details
router.get("/:id", optionalAuth, getListing);

export default router;
