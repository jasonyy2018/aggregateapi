const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public"
  });

  await client.connect();
  console.log("Connected to DB.");

  const email = "admin@aggregateapi.com";
  const res = await client.query('SELECT * FROM "User" WHERE email = $1', [email]);
  if (res.rows.length > 0) {
    console.log("Admin exists.");
    const id = res.rows[0].id;
    await client.query('UPDATE "User" SET role = $1 WHERE id = $2', ['ADMIN', id]);
    console.log("Role ensured as ADMIN");
  } else {
    console.log("Creating admin...");
    const hash = await bcrypt.hash("admin", 10);
    const id = uuidv4();
    
    await client.query(`
      INSERT INTO "User" (id, email, password, name, role, balance, "createdAt", "updatedAt") 
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [id, email, hash, "Platform Admin", "ADMIN", 99999.0]);
    console.log("Admin created!");
  }

  await client.end();
}

main().catch(console.error);
