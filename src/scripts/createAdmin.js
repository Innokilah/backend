import bcrypt from "bcryptjs";
import { getPool } from "../db.js";

const [, , name, email, password, phone = ""] = process.argv;

if (!name || !email || !password) {
  console.error(
    "Usage: node src/scripts/createAdmin.js \"Admin Name\" email@example.com password [phone]"
  );
  process.exit(1);
}

async function main() {
  const pool = getPool();
  const [[existing]] = await pool.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    "INSERT INTO users (role, status, name, email, phone, password_hash) VALUES ('admin', 'approved', ?, ?, ?, ?)",
    [name, email, phone || null, passwordHash]
  );

  console.log(`Admin created with id ${result.insertId}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error("Failed to create admin:", error.message);
  try {
    await getPool().end();
  } catch {
    // ignore connection cleanup errors
  }
  process.exit(1);
});
