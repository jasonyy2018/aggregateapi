/**
 * check-kie-models.mjs
 * Queries the database for Kie.ai provider and all its models.
 * Also queries Kie.ai /v1/models to see what the upstream returns dynamically.
 */
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

  // 1. Find Kie provider
  const provRes = await client.query(
    `SELECT id, name, slug, "baseUrl", "isEnabled", "apiKeyCipher" IS NOT NULL as has_key, "apiKeyCipher"
     FROM "Provider" WHERE slug='kie' OR "baseUrl" LIKE '%kie.ai%'`
  );
  if (provRes.rows.length === 0) {
    console.log('❌ Kie provider not found in DB');
    await client.end();
    return;
  }
  const prov = provRes.rows[0];
  console.log(`\n✅ Found Kie provider:`);
  console.log(`   ID: ${prov.id}`);
  console.log(`   Name: ${prov.name}`);
  console.log(`   Slug: ${prov.slug}`);
  console.log(`   BaseUrl: ${prov.baseUrl}`);
  console.log(`   Enabled: ${prov.isEnabled}`);
  console.log(`   Has Key: ${prov.has_key}`);

  // 2. List all models in DB for this provider
  const modelsRes = await client.query(
    `SELECT "modelId", "displayName", "isEnabled", capabilities, "inputPricePer1k", "costInputPer1k"
     FROM "ProviderModel" WHERE "providerId" = $1
     ORDER BY "modelId"`, [prov.id]
  );
  console.log(`\n📋 Models in DB for Kie provider: ${modelsRes.rows.length}`);
  console.log('─'.repeat(110));
  console.log(`${'Model ID'.padEnd(50)} ${'Display Name'.padEnd(30)} ${'Enabled'.padEnd(8)} ${'Capabilities'.padEnd(15)} Price`);
  console.log('─'.repeat(110));
  for (const m of modelsRes.rows) {
    const caps = (m.capabilities || []).join(',') || '-';
    console.log(`${m.modelId.padEnd(50)} ${(m.displayName || '').padEnd(30)} ${String(m.isEnabled).padEnd(8)} ${caps.padEnd(15)} ${m.inputPricePer1k}`);
  }

  // 3. Check if seedance-2-mini specifically exists
  const seedanceMini = modelsRes.rows.find(m => m.modelId.includes('seedance-2-mini'));
  if (seedanceMini) {
    console.log(`\n✅ seedance-2-mini found in DB: modelId="${seedanceMini.modelId}", enabled=${seedanceMini.isEnabled}`);
  } else {
    console.log(`\n❌ seedance-2-mini NOT found in DB`);
  }

  // 4. Query upstream Kie.ai /v1/models dynamically
  if (prov.apiKeyCipher) {
    try {
      const apiKey = decryptSecret(prov.apiKeyCipher);
      const base = prov.baseUrl.replace(/\/+$/, '');
      console.log(`\n🌐 Querying upstream: ${base}/models ...`);
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          console.log(`   ✅ Upstream returned ${data.data.length} models`);
          
          // Check for seedance models
          const seedanceModels = data.data.filter(m => m.id.toLowerCase().includes('seedance'));
          if (seedanceModels.length > 0) {
            console.log(`\n   🔍 Seedance models in upstream response:`);
            for (const m of seedanceModels) {
              console.log(`      - id: "${m.id}", name: "${m.display_name || m.name || m.id}"`);
            }
          } else {
            console.log(`   ⚠️ No seedance models found in upstream /models response`);
          }

          // Show all model IDs for reference
          console.log(`\n   📋 All upstream model IDs:`);
          for (const m of data.data) {
            console.log(`      - ${m.id}`);
          }
        }
      } else {
        console.log(`   ❌ Upstream returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`   ❌ Failed to query upstream: ${e.message}`);
    }
  }

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
