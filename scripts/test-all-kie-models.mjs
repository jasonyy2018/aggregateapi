/**
 * test-all-kie-models.mjs
 *
 * Probes every upstream KIE model ID by submitting a minimal createTask request
 * and checking whether KIE accepts it (code 200/0) or rejects it.
 *
 * Usage:
 *   node scripts/test-all-kie-models.mjs
 *
 * Reads DATABASE_URL and ENCRYPTION_KEY from env (or uses defaults).
 * Prints a clear ✅ / ❌ table at the end.
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

// ─── All upstream model IDs to probe ────────────────────────────────────────
// Format: { upstreamId, input, label }
const PROBES = [
  // Image – width/height style
  { upstreamId: 'flux-schnell',         input: { prompt: 'test cat', width: 512, height: 512 },           label: 'Flux Schnell' },
  { upstreamId: 'flux-kontext-dev',     input: { prompt: 'test cat', width: 512, height: 512 },           label: 'Flux Kontext Dev' },
  { upstreamId: 'flux-kontext-pro',     input: { prompt: 'test cat', width: 512, height: 512 },           label: 'Flux Kontext Pro' },
  { upstreamId: 'mj_txt2img',           input: { prompt: 'test cat', width: 512, height: 512 },           label: 'Midjourney' },
  { upstreamId: 'google-imagen4',       input: { prompt: 'test cat', width: 512, height: 512 },           label: 'Google Imagen 4' },

  // Image – resolution style
  { upstreamId: 'nano-banana-2',               input: { prompt: 'test cat', resolution: '1K' },           label: 'Nano Banana 2 (1K)' },
  { upstreamId: 'nano-banana-pro',             input: { prompt: 'test cat', resolution: '2K' },           label: 'Nano Banana Pro (2K)' },
  { upstreamId: 'topaz-image-upscaler',        input: { prompt: 'test cat', resolution: '2K' },           label: 'Topaz Upscaler (2K)' },
  { upstreamId: 'gpt-image-2-text-to-image',  input: { prompt: 'test cat', resolution: '1K' },           label: 'GPT Image 2 Text-to-Image (1K)' },
  { upstreamId: 'gpt-image-2-image-to-image', input: { prompt: 'test cat', resolution: '1K', reference_image_urls: ['https://picsum.photos/512'] }, label: 'GPT Image 2 Image-to-Image (1K)' },

  // Image – quality style (GPT Image 1.5)
  { upstreamId: 'gpt-image-1.5/text-to-image',   input: { prompt: 'test cat', quality: 'medium' },       label: 'GPT Image 1.5 Text-to-Image (medium)' },
  { upstreamId: 'gpt-image-1.5/image-to-image',  input: { prompt: 'test cat', quality: 'medium', reference_image_urls: ['https://picsum.photos/512'] }, label: 'GPT Image 1.5 Image-to-Image (medium)' },

  // Legacy / deprecated guesses
  { upstreamId: 'gpt-image-2',               input: { prompt: 'test cat', width: 512, height: 512 },     label: '⚠️ gpt-image-2 (legacy, expect rejection)' },
  { upstreamId: 'gpt-image-2/text-to-image', input: { prompt: 'test cat', width: 512, height: 512 },     label: '⚠️ gpt-image-2/text-to-image (slash format, expect rejection)' },

  // Video
  { upstreamId: 'kling-2.6/text-to-video',   input: { prompt: 'test video', aspect_ratio: '16:9' },       label: 'Kling 2.6 Text-to-Video (legacy alias)' },
  { upstreamId: 'kling-2.6/motion-control',  input: { prompt: 'test video', aspect_ratio: '16:9', resolution: '720p' }, label: 'Kling 2.6 Motion Control' },
  { upstreamId: 'runway-gen3/text-to-video', input: { prompt: 'test video', aspect_ratio: '16:9' },       label: 'Runway Gen-3 (legacy alias)' },
  { upstreamId: 'veo3',                      input: { prompt: 'test video', aspect_ratio: '16:9' },       label: 'Veo 3' },
  { upstreamId: 'grok-imagine/text-to-video',  input: { prompt: 'test video', aspect_ratio: '16:9', resolution: '480p' }, label: 'Grok Imagine Text-to-Video' },
  { upstreamId: 'grok-imagine/image-to-video', input: { prompt: 'test video', aspect_ratio: '16:9', resolution: '480p', image_url: 'https://picsum.photos/512' }, label: 'Grok Imagine Image-to-Video' },
  { upstreamId: 'bytedance/seedance-2',        input: { prompt: 'test video', aspect_ratio: '16:9', resolution: '480p' }, label: 'Seedance 2.0' },
  { upstreamId: 'bytedance/seedance-2-fast',   input: { prompt: 'test video', aspect_ratio: '16:9' },     label: 'Seedance 2.0 Fast' },
  { upstreamId: 'gemini-omni-video',           input: { prompt: 'test video', aspect_ratio: '16:9' },     label: 'Gemini Omni Video' },

  // Music
  { upstreamId: 'suno', input: { prompt: 'happy pop song', style: 'pop' }, label: 'Suno Music' },
];

async function probe(cleanBase, apiKey, { upstreamId, input }) {
  const payload = { model: upstreamId, input };
  try {
    const res = await fetch(`${cleanBase}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    // HTML response = bad gateway / server error
    if (text.trimStart().startsWith('<')) {
      return { ok: false, reason: `HTML response (HTTP ${res.status})` };
    }
    let data;
    try { data = JSON.parse(text); } catch { return { ok: false, reason: `Non-JSON: ${text.slice(0, 80)}` }; }

    const code = data?.code ?? (res.ok ? 200 : res.status);
    if ((code === 200 || code === 0) && data?.data?.taskId) {
      return { ok: true, taskId: data.data.taskId };
    }
    return { ok: false, reason: `code=${code} msg=${data?.msg || '(none)'}` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function main() {
  await client.connect();

  const res = await client.query(
    `SELECT "baseUrl", "apiKeyCipher" FROM "Provider" WHERE (slug='kie' OR "baseUrl" LIKE '%kie.ai%') AND "isEnabled"=true LIMIT 1`
  );
  if (res.rows.length === 0) {
    console.error('❌ KIE provider not found or disabled in DB');
    await client.end(); return;
  }
  const { baseUrl, apiKeyCipher } = res.rows[0];
  const apiKey = decryptSecret(apiKeyCipher);
  const cleanBase = baseUrl.replace(/\/v1$/, '').replace(/\/+$/, '');
  console.log(`\n🔑 Using KIE provider at: ${cleanBase}\n`);

  const results = [];
  for (const probe_ of PROBES) {
    process.stdout.write(`  Testing ${probe_.label.padEnd(55)} ... `);
    const result = await probe(cleanBase, apiKey, probe_);
    results.push({ ...probe_, ...result });
    console.log(result.ok ? `✅ OK (taskId: ${result.taskId})` : `❌ FAIL: ${result.reason}`);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  const passed = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  console.log(`\n✅ Working (${passed.length}):`);
  passed.forEach(r => console.log(`   ${r.upstreamId}`));
  console.log(`\n❌ Not working (${failed.length}):`);
  failed.forEach(r => console.log(`   ${r.upstreamId.padEnd(50)} → ${r.reason}`));
  console.log('');

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
