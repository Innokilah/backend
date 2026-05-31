import { getPool } from "../db.js";

export async function findUserByEmail(email) {
  const pool = getPool();
  const [[user]] = await pool.execute(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  return user || null;
}

export async function createUser({
  role,
  status,
  name,
  email,
  phone,
  passwordHash,
}) {
  const pool = getPool();
  const [result] = await pool.execute(
    "INSERT INTO users (role, status, name, email, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
    [role, status, name, email, phone || null, passwordHash]
  );
  return result.insertId;
}

export async function getUserById(id) {
  const pool = getPool();
  const [[user]] = await pool.execute(
    "SELECT id, role, status, name, email, phone, created_at FROM users WHERE id = ?",
    [id]
  );
  return user || null;
}

export async function listOwners(status) {
  const pool = getPool();
  if (status) {
    const [rows] = await pool.execute(
      "SELECT id, role, status, name, email, phone, created_at FROM users WHERE role = 'owner' AND status = ? ORDER BY created_at DESC",
      [status]
    );
    return rows;
  }
  const [rows] = await pool.execute(
    "SELECT id, role, status, name, email, phone, created_at FROM users WHERE role = 'owner' ORDER BY created_at DESC"
  );
  return rows;
}

export async function updateUserStatus(id, status) {
  const pool = getPool();
  const [result] = await pool.execute(
    "UPDATE users SET status = ? WHERE id = ?",
    [status, id]
  );
  return result.affectedRows > 0;
}

export async function updateOwnerUser(id, fields) {
  const updates = [];
  const values = [];

  if (fields.status) {
    updates.push("status = ?");
    values.push(fields.status);
  }
  if (fields.name) {
    updates.push("name = ?");
    values.push(fields.name);
  }
  if (fields.email) {
    updates.push("email = ?");
    values.push(fields.email);
  }
  if (fields.phone !== undefined) {
    updates.push("phone = ?");
    values.push(fields.phone || null);
  }

  if (updates.length === 0) return false;

  values.push(id);
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  return result.affectedRows > 0;
}

export async function deleteUser(id) {
  const pool = getPool();
  const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
}
