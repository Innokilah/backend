import { getPool } from "../db.js";

function mapSenderRole(role) {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "client";
}

export async function createOrGetOwnerThread({ listingId, clientUserId }) {
  const pool = getPool();
  const [[listing]] = await pool.execute(
    "SELECT id, title, owner_id FROM listings WHERE id = ?",
    [listingId]
  );
  if (!listing) return null;
  if (!listing.owner_id) {
    return null;
  }

  const [[existing]] = await pool.execute(
    `SELECT *
     FROM message_threads
     WHERE thread_type = 'owner_contact'
       AND listing_id = ?
       AND client_user_id = ?
       AND owner_user_id = ?
     LIMIT 1`,
    [listingId, clientUserId, listing.owner_id]
  );
  if (existing) return existing;

  const subject = `Owner contact: ${listing.title}`;
  const [result] = await pool.execute(
    `INSERT INTO message_threads
      (thread_type, status, subject, listing_id, client_user_id, owner_user_id, created_by_user_id)
     VALUES ('owner_contact', 'open', ?, ?, ?, ?, ?)`,
    [subject, listingId, clientUserId, listing.owner_id, clientUserId]
  );
  await pool.execute(
    `INSERT INTO message_entries
      (thread_id, sender_user_id, sender_role, body)
     VALUES (?, NULL, 'system', ?)`,
    [
      result.insertId,
      "Connection fee paid. Client and owner can now communicate here.",
    ]
  );
  const [[thread]] = await pool.execute(
    "SELECT * FROM message_threads WHERE id = ?",
    [result.insertId]
  );
  return thread || null;
}

export async function createSupportThread({
  createdByUserId,
  createdByRole,
  subject,
  body,
}) {
  const pool = getPool();
  const clientUserId = createdByRole === "client" ? createdByUserId : null;
  const ownerUserId = createdByRole === "owner" ? createdByUserId : null;

  const [threadResult] = await pool.execute(
    `INSERT INTO message_threads
      (thread_type, status, subject, client_user_id, owner_user_id, created_by_user_id)
     VALUES ('support', 'open', ?, ?, ?, ?)`,
    [subject || "Support request", clientUserId, ownerUserId, createdByUserId]
  );

  await pool.execute(
    `INSERT INTO message_entries
      (thread_id, sender_user_id, sender_role, body)
     VALUES (?, ?, ?, ?)`,
    [threadResult.insertId, createdByUserId, mapSenderRole(createdByRole), body]
  );

  const [[thread]] = await pool.execute(
    "SELECT * FROM message_threads WHERE id = ?",
    [threadResult.insertId]
  );
  return thread || null;
}

export async function addMessageToThread({
  threadId,
  senderUserId,
  senderRole,
  body,
}) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO message_entries
      (thread_id, sender_user_id, sender_role, body)
     VALUES (?, ?, ?, ?)`,
    [threadId, senderUserId || null, mapSenderRole(senderRole), body]
  );
  await pool.execute(
    "UPDATE message_threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [threadId]
  );
}

export async function getThreadById(threadId) {
  const pool = getPool();
  const [[thread]] = await pool.execute(
    `SELECT t.*,
            l.title AS listing_title,
            client.name AS client_name,
            owner.name AS owner_name,
            creator.name AS created_by_name
     FROM message_threads t
     LEFT JOIN listings l ON l.id = t.listing_id
     LEFT JOIN users client ON client.id = t.client_user_id
     LEFT JOIN users owner ON owner.id = t.owner_user_id
     LEFT JOIN users creator ON creator.id = t.created_by_user_id
     WHERE t.id = ?`,
    [threadId]
  );
  return thread || null;
}

export async function listMessages(threadId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT m.*,
            u.name AS sender_name
     FROM message_entries m
     LEFT JOIN users u ON u.id = m.sender_user_id
     WHERE m.thread_id = ?
     ORDER BY m.created_at ASC, m.id ASC`,
    [threadId]
  );
  return rows;
}

export async function listThreadsForUser(user) {
  const pool = getPool();
  let query = `
    SELECT t.*,
           l.title AS listing_title,
           client.name AS client_name,
           owner.name AS owner_name,
           creator.name AS created_by_name,
           last_message.body AS last_message_body,
           last_message.created_at AS last_message_at
    FROM message_threads t
    LEFT JOIN listings l ON l.id = t.listing_id
    LEFT JOIN users client ON client.id = t.client_user_id
    LEFT JOIN users owner ON owner.id = t.owner_user_id
    LEFT JOIN users creator ON creator.id = t.created_by_user_id
    LEFT JOIN message_entries last_message
      ON last_message.id = (
        SELECT m2.id
        FROM message_entries m2
        WHERE m2.thread_id = t.id
        ORDER BY m2.created_at DESC, m2.id DESC
        LIMIT 1
      )
  `;
  const values = [];

  if (user.role === "admin") {
    query += " WHERE t.thread_type = 'support'";
  } else if (user.role === "owner") {
    query += " WHERE t.owner_user_id = ? OR t.created_by_user_id = ?";
    values.push(user.id, user.id);
  } else {
    query += " WHERE t.client_user_id = ? OR t.created_by_user_id = ?";
    values.push(user.id, user.id);
  }

  query += " ORDER BY COALESCE(last_message.created_at, t.updated_at, t.created_at) DESC";
  const [rows] = await pool.execute(query, values);
  return rows;
}

export function canUserAccessThread(user, thread) {
  if (!user || !thread) return false;
  if (user.role === "admin") return true;
  if (user.role === "owner") {
    return (
      Number(thread.owner_user_id) === Number(user.id) ||
      Number(thread.created_by_user_id) === Number(user.id)
    );
  }
  return (
    Number(thread.client_user_id) === Number(user.id) ||
    Number(thread.created_by_user_id) === Number(user.id)
  );
}
