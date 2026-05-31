import {
  createListing,
  listAllListings,
  updateAdminListing as updateAdminListingData,
  updateListingStatus,
  deleteListing,
} from "../models/listings.js";
import {
  createUser,
  deleteUser,
  listOwners,
  updateOwnerUser,
  updateUserStatus,
} from "../models/users.js";
import {
  getAdminSupportMessages as getSupportMessages,
  getAdminSupportThreads as listSupportThreads,
  postAdminSupportMessage as postSupportMessage,
} from "./messagesController.js";
import { listPayments } from "../models/payments.js";
import bcrypt from "bcryptjs";
import { getListingById } from "../models/listings.js";
import { sendPushToRole, sendPushToUsers } from "../services/expoPush.js";

export async function getAdminListings(req, res, next) {
  try {
    const items = await listAllListings();
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminListing(req, res, next) {
  try {
    const { status, listing, images, documents } = req.body || {};
    if (listing) {
      const result = await updateAdminListingData({
        id: req.params.id,
        listing,
        images,
        documents,
      });
      if (!result.updated) {
        res.status(404).json({ error: "Listing not found" });
        return;
      }
      res.json({ ok: true });
      return;
    }
    if (status) {
      const existingListing = await getListingById(req.params.id);
      await updateListingStatus(req.params.id, status);
      if (status === "Approved" && existingListing?.status !== "Approved") {
        if (existingListing?.owner_id) {
          await sendPushToUsers([existingListing.owner_id], {
            title: "Your land listing was approved",
            body: `${existingListing.title || "Your property listing"} is now live on eAgent.`,
            data: {
              type: "listing_status",
              listingId: Number(req.params.id),
              status,
            },
          }).catch((error) => {
            console.warn("Failed to send owner listing approval push", error.message);
          });
        }

        await sendPushToRole("client", {
          title: "New property available",
          body: `${existingListing?.title || "A new property"} is now available on eAgent.`,
          data: {
            type: "new_property_available",
            listingId: Number(req.params.id),
          },
        }).catch((error) => {
          console.warn("Failed to send new property push", error.message);
        });
      }
      res.json({ ok: true });
      return;
    }
    res.status(400).json({ error: "No fields to update" });
  } catch (error) {
    next(error);
  }
}

export async function createAdminListing(req, res, next) {
  try {
    const { listing, images, documents } = req.body || {};
    if (!listing) {
      res.status(400).json({ error: "Listing payload required" });
      return;
    }
    const id = await createListing({ listing, images, documents });
    res.status(201).json({ id, status: listing.status || "Submitted" });
  } catch (error) {
    next(error);
  }
}

export async function deleteAdminListing(req, res, next) {
  try {
    const ok = await deleteListing(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getOwnerUsers(req, res, next) {
  try {
    const status = req.query.status || "";
    const items = await listOwners(status || undefined);
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnerStatus(req, res, next) {
  try {
    const { status, name, email, phone } = req.body || {};
    if (!status && !name && !email && phone === undefined) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }
    const ok = await updateOwnerUser(req.params.id, {
      status,
      name,
      email,
      phone,
    });
    if (!ok) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function createOwnerUser(req, res, next) {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = await createUser({
      role: "owner",
      status: "approved",
      name,
      email,
      phone,
      passwordHash,
    });
    res.status(201).json({
      id: userId,
      role: "owner",
      status: "approved",
      name,
      email,
      phone,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteOwnerUser(req, res, next) {
  try {
    const ok = await deleteUser(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function getAdminPayments(req, res, next) {
  try {
    const { status = "", paymentType = "", method = "" } = req.query || {};
    const items = await listPayments({
      status: status || undefined,
      paymentType: paymentType || undefined,
      method: method || undefined,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function sendAdminTestPush(req, res, next) {
  try {
    const {
      userId,
      role,
      title = "Test push notification",
      body = "This is a test notification from the admin dashboard.",
      data = {},
    } = req.body || {};

    const trimmedRole = String(role || "").trim().toLowerCase();
    const numericUserId = Number(userId);

    if (!Number.isFinite(numericUserId) && !trimmedRole) {
      res.status(400).json({ error: "Provide either a userId or a role" });
      return;
    }

    if (trimmedRole && !["admin", "owner", "client"].includes(trimmedRole)) {
      res.status(400).json({ error: "Role must be admin, owner, or client" });
      return;
    }

    const payload = {
      title: String(title || "Test push notification"),
      body: String(body || "This is a test notification from the admin dashboard."),
      data:
        data && typeof data === "object" && !Array.isArray(data)
          ? data
          : {},
    };

    const result = Number.isFinite(numericUserId)
      ? await sendPushToUsers([numericUserId], payload)
      : await sendPushToRole(trimmedRole, payload);

    res.json({
      ok: true,
      target: Number.isFinite(numericUserId)
        ? { userId: numericUserId }
        : { role: trimmedRole },
      result,
    });
  } catch (error) {
    next(error);
  }
}

export const getAdminSupportThreads = listSupportThreads;
export const getAdminSupportMessages = getSupportMessages;
export const postAdminSupportMessage = postSupportMessage;
