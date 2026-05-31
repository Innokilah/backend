import {
  createListing,
  deleteOwnerListing,
  listOwnerListings,
  updateOwnerListing,
} from "../models/listings.js";
import {
  findUserByEmail,
  getUserById,
  updateOwnerUser,
} from "../models/users.js";

export async function createOwnerListing(req, res, next) {
  try {
    const { listing, images, documents } = req.body || {};
    if (!listing) {
      res.status(400).json({ error: "Listing payload required" });
      return;
    }
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    listing.owner_id = ownerId;
    listing.status = "Pending Payment";
    const id = await createListing({ listing, images, documents });
    res.status(201).json({
      id,
      status: "Pending Payment",
      paymentRequired: true,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOwnerListings(req, res, next) {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const items = await listOwnerListings(ownerId);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnerListingById(req, res, next) {
  try {
    const { listing, images, documents } = req.body || {};
    if (!listing) {
      res.status(400).json({ error: "Listing payload required" });
      return;
    }
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = req.params.id;
    const result = await updateOwnerListing({
      id,
      ownerId,
      listing,
      images,
      documents,
    });
    if (!result.updated) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteOwnerListingById(req, res, next) {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const ok = await deleteOwnerListing(req.params.id, ownerId);
    if (!ok) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnerProfile(req, res, next) {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { name, email, phone } = req.body || {};
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing && Number(existing.id) !== Number(ownerId)) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const ok = await updateOwnerUser(ownerId, { name, email, phone });
    if (!ok) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = await getUserById(ownerId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
