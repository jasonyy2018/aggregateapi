import pg from 'pg';
import { createDecipheriv, createHash } from 'crypto';

const conn = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public';
const client = new pg.Client({ connectionString: conn });

function deriveKey(secret) {
  return createHash('sha256').update(secret).digest();
}

function decryptSecret(ciphertext) {
  const encKey = process.env.ENCRYPTION_KEY || 'dev-only-encryption-key-change-me-in-production-please-use-openssl-rand-base64-32';
  const key = deriveKey(encKey);
  const buf = Buffer.from(ciphertext, 'hex');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(16, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, 'utf8') + decipher.final('utf8');
}

async function main() {
  await client.connect();
  const res = await client.query(`SELECT id, name, slug, "baseUrl", "isEnabled", "apiKeyCipher" IS NOT NULL as has_key FROM "Provider" WHERE slug='kie' OR "baseUrl" LIKE '%kie.ai%'`);
  
  if (res.rows.length === 0) {
    console.log('❌ Kie provider not found in DB');
    await client.end();
    return;
  }

  const p = res.rows[0];
  console.log('Provider:', p.name, '| slug:', p.slug, '| baseUrl:', p.baseUrl);
  console.log('Enabled:', p.isEnabled);
  console.log('Has API key:', p.has_key);

  if (!p.has_key) {
    console.log('❌ No API key configured for Kie provider');
  } else {
    const keyRes = await client.query(`SELECT "apiKeyCipher" FROM "Provider" WHERE id = $1`, [p.id]);
    const apiKey = decryptSecret(keyRes.rows[0].apiKeyCipher);
    console.log('API Key (first 8):', apiKey.slice(0, 8) + '...');

    console.log('\n--- Test 1: GET /v1/models ---');
    try {
      const r = await fetch(p.baseUrl.replace(/\/+$/, '') + '/models', {
        headers: { Authorization: 'Bearer ' + apiKey }
      });
      console.log('Status:', r.status);
      if (r.ok) {
        const j = await r.json();
        console.log('Models count:', j.data?.length || 0);
        if (j.data?.length > 0) console.log('First model:', j.data[0].id);
      } else {
        const t = await r.text();
        console.log('Response:', t.slice(0, 200));
      }
    } catch (e) { console.log('Error:', e.message); }

    console.log('\n--- Test 2: GET /api/v1/chat/credit ---');
    try {
      const cleanBase = p.baseUrl.replace(/\/v1$/, '').replace(/\/+$/, '');
      const r = await fetch(cleanBase + '/api/v1/chat/credit', {
        headers: { Authorization: 'Bearer ' + apiKey }
      });
      console.log('Status:', r.status);
      const t = await r.text();
      console.log('Response:', t.slice(0, 200));
    } catch (e) { console.log('Error:', e.message); }

    console.log('\n--- Test 3: POST createTask (flux-schnell) ---');
    try {
      const cleanBase = p.baseUrl.replace(/\/v1$/, '').replace(/\/+$/, '');
      const r = await fetch(cleanBase + '/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model: 'flux-schnell', input: { prompt: 'test', width: 1024, height: 1024 } })
      });
      console.log('Status:', r.status);
      const j = await r.json();
      console.log('Response:', JSON.stringify(j).slice(0, 300));
    } catch (e) { console.log('Error:', e.message); }

    console.log('\n--- Test 4: POST createTask (flux-kontext-dev) ---');
    try {
      const cleanBase = p.baseUrl.replace(/\/v1$/, '').replace(/\/+$/, '');
      const r = await fetch(cleanBase + '/api/v1/jobs/createTask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model: 'flux-kontext-dev', input: { prompt: 'test', width: 1024, height: 1024 } })
      });
      console.log('Status:', r.status);
      const j = await r.json();
      console.log('Response:', JSON.stringify(j).slice(0, 300));
    } catch (e) { console.log('Error:', e.message); }
  }

  await client.end();
}

main().catch(e => { console.log('FATAL:', e.message); process.exit(1); });
