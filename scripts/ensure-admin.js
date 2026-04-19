/**
 * Ensure admin account exists in production.
 * Runs as a plain Node.js script (no TS, no bundler).
 * Uses the pg driver directly to avoid Prisma CLI dependency in the runner image.
 */

const { Client } = require("pg");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("[ensure-admin] DATABASE_URL not set, skipping.");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const email = process.env.ADMIN_EMAIL || "admin@aggregateapi.com";
  const password = process.env.ADMIN_PASSWORD || "admin";

  // Check if admin exists
  const res = await client.query('SELECT id, role FROM "User" WHERE email = $1', [email]);
  if (res.rows.length > 0) {
    // Ensure role is ADMIN
    if (res.rows[0].role !== "ADMIN") {
      await client.query('UPDATE "User" SET role = $1, "updatedAt" = NOW() WHERE id = $2', [
        "ADMIN",
        res.rows[0].id,
      ]);
      console.log(`[ensure-admin] Promoted ${email} to ADMIN`);
    } else {
      console.log(`[ensure-admin] Admin ${email} already exists`);
    }
  } else {
    // Create admin - bcrypt hash the password
    // bcrypt.hashSync("admin", 10) pre-computed for the default password
    let hash;
    try {
      const bcrypt = require("bcryptjs");
      hash = await bcrypt.hash(password, 10);
    } catch {
      // Fallback: pre-computed hash of "admin"
      hash = "$2a$10$xDQbCxDzR6o9P8fFZLbKxOF8qWm.yCmD0.CxGhLbhk9YJZ4Z5FY6y";
      console.log("[ensure-admin] bcryptjs not available, using pre-computed hash");
    }

    const { randomUUID } = require("crypto");
    const id = randomUUID().replace(/-/g, "").slice(0, 25);

    await client.query(
      `INSERT INTO "User" (id, email, password, name, role, balance, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id, email, hash, "Platform Admin", "ADMIN", 99999.0]
    );
    console.log(`[ensure-admin] Created admin: ${email} / ${password}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("[ensure-admin] Error:", err.message);
  process.exit(0); // Non-fatal: don't block server startup
});
