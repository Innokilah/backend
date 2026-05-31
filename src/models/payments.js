import { getPool } from "../db.js";

export const CONNECTION_FEE_AMOUNT = 300;
export const CONNECTION_FEE_CURRENCY = "MWK";
export const LISTING_SUBMISSION_FEE_AMOUNT = 300;
export const LISTING_SUBMISSION_FEE_CURRENCY = "MWK";

export async function findPaidConnectionFee(userId, listingId) {
  const pool = getPool();
  const [[payment]] = await pool.execute(
    `SELECT *
     FROM payments
     WHERE user_id = ? AND listing_id = ? AND payment_type = 'connection_fee' AND status = 'Paid'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, listingId]
  );
  return payment || null;
}

export async function findPaymentByProviderRef(providerRef) {
  const pool = getPool();
  const [[payment]] = await pool.execute(
    `SELECT *
     FROM payments
     WHERE provider_ref = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [providerRef]
  );
  return payment || null;
}

export async function findPaidListingSubmissionPayment(userId, listingId) {
  const pool = getPool();
  const [[payment]] = await pool.execute(
    `SELECT *
     FROM payments
     WHERE user_id = ? AND listing_id = ? AND payment_type = 'listing_submission' AND status = 'Paid'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, listingId]
  );
  return payment || null;
}

export async function findConnectionFeePaymentForUser({
  userId,
  listingId,
  providerRef,
}) {
  const pool = getPool();
  const values = [userId];
  const conditions = ["user_id = ?", "payment_type = 'connection_fee'"];

  if (listingId) {
    conditions.push("listing_id = ?");
    values.push(listingId);
  }

  if (providerRef) {
    conditions.push("provider_ref = ?");
    values.push(providerRef);
  }

  const [[payment]] = await pool.execute(
    `SELECT *
     FROM payments
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 1`,
    values
  );

  return payment || null;
}

export async function findListingSubmissionPaymentForOwner({
  userId,
  listingId,
  providerRef,
}) {
  const pool = getPool();
  const values = [userId];
  const conditions = ["user_id = ?", "payment_type = 'listing_submission'"];

  if (listingId) {
    conditions.push("listing_id = ?");
    values.push(listingId);
  }

  if (providerRef) {
    conditions.push("provider_ref = ?");
    values.push(providerRef);
  }

  const [[payment]] = await pool.execute(
    `SELECT *
     FROM payments
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT 1`,
    values
  );

  return payment || null;
}

export async function createPendingConnectionFeePayment({
  userId,
  listingId,
  method,
  providerRef,
}) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO payments
      (listing_id, user_id, payment_type, amount, currency, method, status, provider_ref)
     VALUES (?, ?, 'connection_fee', ?, ?, ?, 'Pending', ?)`,
    [
      listingId,
      userId,
      CONNECTION_FEE_AMOUNT,
      CONNECTION_FEE_CURRENCY,
      method || "paychangu",
      providerRef,
    ]
  );

  const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id = ?", [
    result.insertId,
  ]);
  return payment || null;
}

export async function createPendingListingSubmissionPayment({
  userId,
  listingId,
  method,
  providerRef,
}) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO payments
      (listing_id, user_id, payment_type, amount, currency, method, status, provider_ref)
     VALUES (?, ?, 'listing_submission', ?, ?, ?, 'Pending', ?)`,
    [
      listingId,
      userId,
      LISTING_SUBMISSION_FEE_AMOUNT,
      LISTING_SUBMISSION_FEE_CURRENCY,
      method || "paychangu",
      providerRef,
    ]
  );

  const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id = ?", [
    result.insertId,
  ]);
  return payment || null;
}

export async function markPaymentPaid({
  paymentId,
  providerRef,
  method,
}) {
  const pool = getPool();

  if (paymentId) {
    await pool.execute(
      `UPDATE payments
       SET status = 'Paid',
           method = COALESCE(?, method),
           provider_ref = COALESCE(?, provider_ref),
           paid_at = COALESCE(paid_at, NOW())
       WHERE id = ?`,
      [method || null, providerRef || null, paymentId]
    );
    const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id = ?", [
      paymentId,
    ]);
    return payment || null;
  }

  if (!providerRef) return null;

  await pool.execute(
    `UPDATE payments
     SET status = 'Paid',
         method = COALESCE(?, method),
         paid_at = COALESCE(paid_at, NOW())
     WHERE provider_ref = ?`,
    [method || null, providerRef]
  );

  return findPaymentByProviderRef(providerRef);
}

export async function markPaymentFailed({
  paymentId,
  providerRef,
  method,
}) {
  const pool = getPool();

  if (paymentId) {
    await pool.execute(
      `UPDATE payments
       SET status = 'Failed',
           method = COALESCE(?, method)
       WHERE id = ? AND status <> 'Paid'`,
      [method || null, paymentId]
    );
    const [[payment]] = await pool.execute("SELECT * FROM payments WHERE id = ?", [
      paymentId,
    ]);
    return payment || null;
  }

  if (!providerRef) return null;

  await pool.execute(
    `UPDATE payments
     SET status = 'Failed',
         method = COALESCE(?, method)
     WHERE provider_ref = ? AND status <> 'Paid'`,
    [method || null, providerRef]
  );

  return findPaymentByProviderRef(providerRef);
}

export async function listPayments({
  status,
  paymentType,
  method,
} = {}) {
  const pool = getPool();
  const values = [];
  const conditions = [];

  if (status) {
    conditions.push("p.status = ?");
    values.push(status);
  }

  if (paymentType) {
    conditions.push("p.payment_type = ?");
    values.push(paymentType);
  }

  if (method) {
    conditions.push("p.method = ?");
    values.push(method);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const [rows] = await pool.execute(
    `SELECT p.*,
            l.title AS listing_title,
            l.location AS listing_location,
            l.owner_name AS listing_owner_name,
            u.name AS client_name,
            u.email AS client_email,
            u.phone AS client_phone
     FROM payments p
     LEFT JOIN listings l ON l.id = p.listing_id
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY COALESCE(p.paid_at, p.updated_at, p.created_at) DESC, p.id DESC`,
    values
  );

  return rows;
}
