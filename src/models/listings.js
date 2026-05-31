import { getPool } from "../db.js";

function getListingDescription(listing) {
  return listing.land_description || listing.description || null;
}

export async function createListing({ listing, images = [], documents = [] }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO listings
        (owner_id, property_type, listing_type, title, location, price, size, bedrooms, bathrooms, toilets,
         land_size, plot_number, zoning, land_description,
         owner_name, owner_phone, owner_email, owner_whatsapp,
         bedroom_condition, bathroom_condition, toilet_condition, dining_condition,
         status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listing.owner_id || null,
        listing.property_type,
        listing.listing_type,
        listing.title,
        listing.location,
        listing.price,
        listing.size || null,
        listing.bedrooms ?? null,
        listing.bathrooms ?? null,
        listing.toilets ?? null,
        listing.land_size || null,
        listing.plot_number || null,
        listing.zoning || null,
        getListingDescription(listing),
        listing.owner_name || null,
        listing.owner_phone || null,
        listing.owner_email || null,
        listing.owner_whatsapp || null,
        listing.bedroom_condition || null,
        listing.bathroom_condition || null,
        listing.toilet_condition || null,
        listing.dining_condition || null,
        listing.status || "Submitted",
      ]
    );

    const listingId = result.insertId;

    if (images.length > 0) {
      const imageValues = images.map((img) => [
        listingId,
        img.label,
        img.url,
        img.is_required ? 1 : 0,
      ]);
      await connection.query(
        "INSERT INTO listing_images (listing_id, label, url, is_required) VALUES ?",
        [imageValues]
      );
    }

    if (documents.length > 0) {
      const docValues = documents.map((doc) => [
        listingId,
        doc.doc_type,
        doc.url,
      ]);
      await connection.query(
        "INSERT INTO listing_documents (listing_id, doc_type, url) VALUES ?",
        [docValues]
      );
    }

    await connection.commit();
    return listingId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listPublicListings(filters = {}) {
  const pool = getPool();
  const conditions = [`l.status = 'Approved'`];
  const values = [];

  if (filters.propertyType) {
    conditions.push("l.property_type = ?");
    values.push(filters.propertyType);
  }

  if (filters.listingType) {
    conditions.push("l.listing_type = ?");
    values.push(filters.listingType);
  }

  if (filters.locationQuery) {
    conditions.push("LOWER(l.location) LIKE ?");
    values.push(`%${String(filters.locationQuery).trim().toLowerCase()}%`);
  }

  if (Number.isFinite(filters.minPrice)) {
    conditions.push("l.price >= ?");
    values.push(filters.minPrice);
  }

  if (Number.isFinite(filters.maxPrice)) {
    conditions.push("l.price <= ?");
    values.push(filters.maxPrice);
  }

  const [rows] = await pool.execute(
    `SELECT l.*, (
        SELECT li.url
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.id ASC
        LIMIT 1
      ) AS cover_image
     FROM listings l
     WHERE ${conditions.join(" AND ")}
     ORDER BY l.created_at DESC`,
    values
  );
  return rows;
}

export async function getListingById(id) {
  const pool = getPool();
  const [[listing]] = await pool.execute(
    "SELECT * FROM listings WHERE id = ?",
    [id]
  );
  if (!listing) return null;

  const [images] = await pool.execute(
    "SELECT * FROM listing_images WHERE listing_id = ?",
    [id]
  );
  const [documents] = await pool.execute(
    "SELECT * FROM listing_documents WHERE listing_id = ?",
    [id]
  );

  return { ...listing, images, documents };
}

export async function getOwnerListingById(id, ownerId) {
  const pool = getPool();
  const [[listing]] = await pool.execute(
    "SELECT * FROM listings WHERE id = ? AND owner_id = ?",
    [id, ownerId]
  );
  return listing || null;
}

export async function listOwnerListings(ownerId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT l.*, (
        SELECT li.url
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.id ASC
        LIMIT 1
      ) AS cover_image
     FROM listings l
     WHERE l.owner_id = ?
     ORDER BY l.created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function listAllListings() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT l.*, (
        SELECT li.url
        FROM listing_images li
        WHERE li.listing_id = l.id
        ORDER BY li.id ASC
        LIMIT 1
      ) AS cover_image
     FROM listings l
     ORDER BY l.created_at DESC`
  );
  return rows;
}

export async function updateListingStatus(id, status) {
  const pool = getPool();
  await pool.execute(
    "UPDATE listings SET status = ? WHERE id = ?",
    [status, id]
  );
}

export async function updateOwnerListing({
  id,
  ownerId,
  listing,
  images = [],
  documents = [],
}) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[existing]] = await connection.execute(
      "SELECT status FROM listings WHERE id = ? AND owner_id = ?",
      [id, ownerId]
    );

    if (!existing) {
      await connection.rollback();
      return { updated: false };
    }

    const [result] = await connection.execute(
      `UPDATE listings SET
        property_type = ?,
        listing_type = ?,
        title = ?,
        location = ?,
        price = ?,
        size = ?,
        bedrooms = ?,
        bathrooms = ?,
        toilets = ?,
        land_size = ?,
        plot_number = ?,
        zoning = ?,
        land_description = ?,
        owner_name = ?,
        owner_phone = ?,
        owner_email = ?,
        owner_whatsapp = ?,
        bedroom_condition = ?,
        bathroom_condition = ?,
        toilet_condition = ?,
        dining_condition = ?,
        status = ?
       WHERE id = ? AND owner_id = ?`,
      [
        listing.property_type,
        listing.listing_type,
        listing.title,
        listing.location,
        listing.price,
        listing.size || null,
        listing.bedrooms ?? null,
        listing.bathrooms ?? null,
        listing.toilets ?? null,
        listing.land_size || null,
        listing.plot_number || null,
        listing.zoning || null,
        getListingDescription(listing),
        listing.owner_name || null,
        listing.owner_phone || null,
        listing.owner_email || null,
        listing.owner_whatsapp || null,
        listing.bedroom_condition || null,
        listing.bathroom_condition || null,
        listing.toilet_condition || null,
        listing.dining_condition || null,
        existing.status || "Submitted",
        id,
        ownerId,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return { updated: false };
    }

    if (Array.isArray(images)) {
      await connection.execute(
        "DELETE FROM listing_images WHERE listing_id = ?",
        [id]
      );
      if (images.length > 0) {
        const imageValues = images.map((img) => [
          id,
          img.label,
          img.url,
          img.is_required ? 1 : 0,
        ]);
        await connection.query(
          "INSERT INTO listing_images (listing_id, label, url, is_required) VALUES ?",
          [imageValues]
        );
      }
    }

    if (Array.isArray(documents)) {
      await connection.execute(
        "DELETE FROM listing_documents WHERE listing_id = ?",
        [id]
      );
      if (documents.length > 0) {
        const docValues = documents.map((doc) => [
          id,
          doc.doc_type,
          doc.url,
        ]);
        await connection.query(
          "INSERT INTO listing_documents (listing_id, doc_type, url) VALUES ?",
          [docValues]
        );
      }
    }

    await connection.commit();
    return { updated: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateAdminListing({ id, listing, images = [], documents = [] }) {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `UPDATE listings SET
        property_type = ?,
        listing_type = ?,
        title = ?,
        location = ?,
        price = ?,
        size = ?,
        bedrooms = ?,
        bathrooms = ?,
        toilets = ?,
        land_size = ?,
        plot_number = ?,
        zoning = ?,
        land_description = ?,
        owner_name = ?,
        owner_phone = ?,
        owner_email = ?,
        owner_whatsapp = ?,
        bedroom_condition = ?,
        bathroom_condition = ?,
        toilet_condition = ?,
        dining_condition = ?,
        status = ?
       WHERE id = ?`,
      [
        listing.property_type,
        listing.listing_type,
        listing.title,
        listing.location,
        listing.price,
        listing.size || null,
        listing.bedrooms ?? null,
        listing.bathrooms ?? null,
        listing.toilets ?? null,
        listing.land_size || null,
        listing.plot_number || null,
        listing.zoning || null,
        getListingDescription(listing),
        listing.owner_name || null,
        listing.owner_phone || null,
        listing.owner_email || null,
        listing.owner_whatsapp || null,
        listing.bedroom_condition || null,
        listing.bathroom_condition || null,
        listing.toilet_condition || null,
        listing.dining_condition || null,
        listing.status || "Submitted",
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return { updated: false };
    }

    if (Array.isArray(images)) {
      await connection.execute(
        "DELETE FROM listing_images WHERE listing_id = ?",
        [id]
      );
      if (images.length > 0) {
        const imageValues = images.map((img) => [
          id,
          img.label,
          img.url,
          img.is_required ? 1 : 0,
        ]);
        await connection.query(
          "INSERT INTO listing_images (listing_id, label, url, is_required) VALUES ?",
          [imageValues]
        );
      }
    }

    if (Array.isArray(documents)) {
      await connection.execute(
        "DELETE FROM listing_documents WHERE listing_id = ?",
        [id]
      );
      if (documents.length > 0) {
        const docValues = documents.map((doc) => [
          id,
          doc.doc_type,
          doc.url,
        ]);
        await connection.query(
          "INSERT INTO listing_documents (listing_id, doc_type, url) VALUES ?",
          [docValues]
        );
      }
    }

    await connection.commit();
    return { updated: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteListing(id) {
  const pool = getPool();
  const [result] = await pool.execute("DELETE FROM listings WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

export async function deleteOwnerListing(id, ownerId) {
  const pool = getPool();
  const [result] = await pool.execute(
    "DELETE FROM listings WHERE id = ? AND owner_id = ?",
    [id, ownerId]
  );
  return result.affectedRows > 0;
}
