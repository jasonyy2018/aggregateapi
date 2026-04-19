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

  const bcrypt = require("bcryptjs");
  const hash = await bcrypt.hash(password, 10);

  // Check if admin exists
  const res = await client.query('SELECT id, role, password FROM "User" WHERE email = $1', [email]);
  if (res.rows.length > 0) {
    const user = res.rows[0];
    let needsUpdate = false;
    
    // Check role
    if (user.role !== "ADMIN") {
      needsUpdate = true;
      console.log(`[ensure-admin] ${email} role is ${user.role}, promoting to ADMIN`);
    }

    // Check if password matches (if it doesn't, we force update to the env var value)
    const pwMatch = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!pwMatch) {
      needsUpdate = true;
      console.log(`[ensure-admin] Password for ${email} has changed or is missing, updating...`);
    }

    if (needsUpdate) {
      await client.query('UPDATE "User" SET role = $1, password = $2, "updatedAt" = NOW() WHERE id = $3', [
        "ADMIN",
        hash,
        user.id,
      ]);
      console.log(`[ensure-admin] Updated ${email} credentials`);
    } else {
      console.log(`[ensure-admin] Admin ${email} is up to date`);
    }
  } else {
    // Create admin
    // Generate a cuid-like ID (25 chars)
    const id = "admin_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 14);

    await client.query(
      `INSERT INTO "User" (id, email, password, name, role, balance, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [id.slice(0, 25), email, hash, "Platform Admin", "ADMIN", 99999.0]
    );
    console.log(`[ensure-admin] Created NEW admin: ${email} / ${password}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("[ensure-admin] Error:", err.message);
  process.exit(0); // Non-fatal
});
