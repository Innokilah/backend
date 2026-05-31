import {
  getListingById,
  listPublicListings,
} from "../models/listings.js";
import { findPaidConnectionFee } from "../models/payments.js";

function withHiddenOwnerContact(item, canViewOwnerContact = false) {
  if (!item) return item;

  return {
    ...item,
    owner_name: canViewOwnerContact ? item.owner_name : null,
    owner_phone: canViewOwnerContact ? item.owner_phone : null,
    owner_email: canViewOwnerContact ? item.owner_email : null,
    owner_whatsapp: canViewOwnerContact ? item.owner_whatsapp : null,
    can_view_owner_contact: canViewOwnerContact,
    requires_connection_fee: true,
  };
}

async function canViewerSeeOwnerContact(user, listing) {
  if (!user || !listing) return false;
  if (user.role === "admin") return true;
  if (user.role === "owner" && Number(user.id) === Number(listing.owner_id)) {
    return true;
  }
  if (user.role !== "client") return false;

  const payment = await findPaidConnectionFee(user.id, listing.id);
  return Boolean(payment);
}

export async function getPublicListings(req, res, next) {
  try {
    const minPrice = Number.parseFloat(req.query.minPrice);
    const maxPrice = Number.parseFloat(req.query.maxPrice);
    const items = await listPublicListings({
      propertyType: req.query.propertyType || undefined,
      listingType: req.query.listingType || undefined,
      locationQuery: req.query.q || undefined,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    });
    res.json({
      items: items.map((item) => withHiddenOwnerContact(item, false)),
    });
  } catch (error) {
    next(error);
  }
}

export async function getListing(req, res, next) {
  try {
    const item = await getListingById(req.params.id);
    if (!item) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    const canViewOwnerContact = await canViewerSeeOwnerContact(req.user, item);
    res.json({ item: withHiddenOwnerContact(item, canViewOwnerContact) });
  } catch (error) {
    next(error);
  }
}
