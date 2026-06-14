import { getPool } from "../db.js";

async function debugPayments() {
  const pool = getPool();
  try {
    console.log("\n=== PAYMENTS TABLE DEBUG ===\n");

    // Check total payments
    const [[{ total }]] = await pool.execute("SELECT COUNT(*) as total FROM payments");
    console.log(`Total payments in DB: ${total}`);

    // Check payments by status
    const [byStatus] = await pool.execute(
      "SELECT status, COUNT(*) as count FROM payments GROUP BY status"
    );
    console.log("\nPayments by status:");
    byStatus.forEach((row) => {
      console.log(`  - ${row.status}: ${row.count}`);
    });

    // Check payments by payment_type
    const [byType] = await pool.execute(
      "SELECT payment_type, COUNT(*) as count FROM payments GROUP BY payment_type"
    );
    console.log("\nPayments by type:");
    byType.forEach((row) => {
      console.log(`  - ${row.payment_type}: ${row.count}`);
    });

    // Show recent payments with details
    console.log("\nLast 10 payments:");
    const [recent] = await pool.execute(`
      SELECT 
        id, user_id, listing_id, payment_type, amount, currency, 
        status, method, provider_ref, created_at, paid_at
      FROM payments
      ORDER BY created_at DESC
      LIMIT 10
    `);
    recent.forEach((row) => {
      console.log(`  ID: ${row.id}`);
      console.log(`    Type: ${row.payment_type} | Status: ${row.status}`);
      console.log(`    Amount: ${row.amount} ${row.currency}`);
      console.log(`    Method: ${row.method} | User: ${row.user_id}`);
      console.log(`    Created: ${row.created_at} | Paid: ${row.paid_at || 'N/A'}`);
      console.log();
    });

    // Test the listPayments query
    console.log("\n=== Testing listPayments query ===\n");
    const [allPayments] = await pool.execute(`
      SELECT p.*,
             l.title AS listing_title,
             l.location AS listing_location,
             u.name AS client_name,
             u.email AS client_email
      FROM payments p
      LEFT JOIN listings l ON l.id = p.listing_id
      LEFT JOIN users u ON u.id = p.user_id
      ORDER BY COALESCE(p.paid_at, p.updated_at, p.created_at) DESC, p.id DESC
      LIMIT 5
    `);
    console.log(`Query returned ${allPayments.length} rows`);
    allPayments.forEach((row) => {
      console.log(`  - Payment ${row.id}: ${row.client_name} paid ${row.amount} ${row.currency} (${row.status})`);
    });

    console.log("\n=== ENV CONFIG ===\n");
    console.log(`PAYCHANGU_MOCK_MODE: ${process.env.PAYCHANGU_MOCK_MODE}`);
    console.log(`PAYCHANGU_SECRET_KEY: ${process.env.PAYCHANGU_SECRET_KEY ? '(set)' : '(not set)'}`);

    process.exit(0);
  } catch (error) {
    console.error("Debug error:", error);
    process.exit(1);
  }
}

debugPayments();
