import pg from 'pg';
const conn = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public';
const client = new pg.Client({ connectionString: conn });
async function main() {
  await client.connect();
  const r = await client.query(`SELECT id, name, slug, "baseUrl", character_length("apiKeyCipher") as key_len, left("apiKeyCipher", 20) as key_prefix, "apiKeyHint" FROM "Provider"`);
  console.log(JSON.stringify(r.rows, null, 2));
  const count = await client.query(`SELECT count(*) FROM "ProviderModel" pm JOIN "Provider" p ON p.id = pm."providerId" WHERE p.slug = 'kie'`);
  console.log('Kie models count:', count.rows[0].count);
  await client.end();
}
main().catch(e => console.error(e.message));
