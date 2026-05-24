/**
 * Seed and enable multimodal models for Kie.ai provider.
 * This runs directly against your Prisma database to register and enable:
 * - Flux Schnell, Flux Dev, Flux Pro
 * - Midjourney v6
 * - Kling Video
 * - Runway Gen-3
 * - Suno AI Music
 *
 * Run with:
 *   npx tsx scripts/seed-multimodal.ts
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/aggregateapi?schema=public";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

const multimodalModels = [
  // Core Multimodal Models
  { id: "flux-schnell", displayName: "Flux Schnell (Kie)", capabilities: ["image"], cost: 0.05, price: 0.05 },
  { id: "flux-dev", displayName: "Flux Dev (Kie)", capabilities: ["image"], cost: 0.10, price: 0.10 },
  { id: "flux-pro", displayName: "Flux Pro (Kie)", capabilities: ["image"], cost: 0.15, price: 0.15 },
  { id: "midjourney", displayName: "Midjourney v6 (Kie)", capabilities: ["image"], cost: 0.20, price: 0.20 },
  { id: "kling", displayName: "Kling Video (Kie)", capabilities: ["video"], cost: 0.25, price: 0.25 },
  { id: "runway", displayName: "Runway Gen-3 (Kie)", capabilities: ["video"], cost: 0.30, price: 0.30 },
  { id: "suno", displayName: "Suno AI Music v3.5 (Kie)", capabilities: ["music"], cost: 0.15, price: 0.15 },

  // Next-Gen LLMs
  { id: "claude-opus-4.7", displayName: "Claude 4.7 Opus (Kie)", capabilities: [], cost: 0.001425, price: 0.001425, costOutput: 0.007150, priceOutput: 0.007150 },
  { id: "claude-sonnet-4.6", displayName: "Claude 4.6 Sonnet (Kie)", capabilities: [], cost: 0.000850, price: 0.000850, costOutput: 0.004275, priceOutput: 0.004275 },
  { id: "gpt-5.5-chat", displayName: "GPT-5.5 Chat (Kie)", capabilities: [], cost: 0.001400, price: 0.001400, costOutput: 0.008400, priceOutput: 0.008400 },

  // Google Nano Banana series (Image)
  { id: "google-nano-banana-2-4k", displayName: "Google Nano Banana 2 4K (Kie)", capabilities: ["image"], cost: 0.09, price: 0.09 },
  { id: "google-nano-banana-2-2k", displayName: "Google Nano Banana 2 2K (Kie)", capabilities: ["image"], cost: 0.06, price: 0.06 },
  { id: "google-nano-banana-2-1k", displayName: "Google Nano Banana 2 1K (Kie)", capabilities: ["image"], cost: 0.04, price: 0.04 },
  { id: "google-nano-banana-pro-1-2k", displayName: "Google Nano Banana Pro 1/2K (Kie)", capabilities: ["image"], cost: 0.09, price: 0.09 },
  { id: "google-nano-banana-pro-4k", displayName: "Google Nano Banana Pro 4K (Kie)", capabilities: ["image"], cost: 0.12, price: 0.12 },

  // Seedance 2.0 Video series (Video)
  { id: "seedance-2.0-720p-no-video-input", displayName: "Seedance 2.0 720p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.205, price: 0.205 },
  { id: "seedance-2.0-720p-with-video-input", displayName: "Seedance 2.0 720p (With Video Input) (Kie)", capabilities: ["video"], cost: 0.125, price: 0.125 },
  { id: "seedance-2.0-480p-no-video-input", displayName: "Seedance 2.0 480p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.095, price: 0.095 },
  { id: "seedance-2.0-480p-with-video-input", displayName: "Seedance 2.0 480p (With Video Input) (Kie)", capabilities: ["video"], cost: 0.057, price: 0.057 },

  // Google Veo 3.1 series (Video)
  { id: "google-veo-3.1-text-to-video-quality-1080p", displayName: "Google Veo 3.1 Text-to-Video 1080p (Kie)", capabilities: ["video"], cost: 1.28, price: 1.28 },
  { id: "google-veo-3.1-image-to-video-quality-1080p", displayName: "Google Veo 3.1 Image-to-Video 1080p (Kie)", capabilities: ["video"], cost: 1.28, price: 1.28 },
  { id: "google-veo-3.1-text-to-video-quality-4k", displayName: "Google Veo 3.1 Text-to-Video 4K (Kie)", capabilities: ["video"], cost: 1.85, price: 1.85 },
  { id: "google-veo-3.1-image-to-video-quality-4k", displayName: "Google Veo 3.1 Image-to-Video 4K (Kie)", capabilities: ["video"], cost: 1.85, price: 1.85 },

  // Grok Imagine Video series (Video)
  { id: "grok-imagine-image-to-video-720p", displayName: "Grok Imagine Image-to-Video 720p (Kie)", capabilities: ["video"], cost: 0.015, price: 0.015 },
  { id: "grok-imagine-text-to-video-720p", displayName: "Grok Imagine Text-to-Video 720p (Kie)", capabilities: ["video"], cost: 0.015, price: 0.015 },
  { id: "grok-imagine-image-to-video-480p", displayName: "Grok Imagine Image-to-Video 480p (Kie)", capabilities: ["video"], cost: 0.008, price: 0.008 },
  { id: "grok-imagine-text-to-video-480p", displayName: "Grok Imagine Text-to-Video 480p (Kie)", capabilities: ["video"], cost: 0.008, price: 0.008 },

  // Gemini 2.5 Flash / Pro (Direct Overrides)
  { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash (Kie)", capabilities: [], cost: 0.000075, price: 0.000090, costOutput: 0.000300, priceOutput: 0.000750 },
  { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro (Kie)", capabilities: [], cost: 0.000300, price: 0.000380, costOutput: 0.002400, priceOutput: 0.003000 },

  // Topaz Image Upscaler
  { id: "topaz-image-upscaler-8k", displayName: "Topaz Image Upscaler 8K (Kie)", capabilities: ["image"], cost: 0.16, price: 0.20 },
  { id: "topaz-image-upscaler-4k", displayName: "Topaz Image Upscaler 4K (Kie)", capabilities: ["image"], cost: 0.08, price: 0.10 },
  { id: "topaz-image-upscaler-2k", displayName: "Topaz Image Upscaler 2K (Kie)", capabilities: ["image"], cost: 0.04, price: 0.05 },

  // Kling 2.6 Motion Control (billed per request/video flat-rate based on average duration)
  { id: "kling-2.6-motion-control-1080p", displayName: "Kling 2.6 Motion Control 1080P (Kie)", capabilities: ["video"], cost: 0.36, price: 0.45 },
  { id: "kling-2.6-motion-control-720p", displayName: "Kling 2.6 Motion Control 720P (Kie)", capabilities: ["video"], cost: 0.22, price: 0.275 },

  // GPT Image 1.5
  { id: "gpt-image-1.5-image-to-image-high", displayName: "GPT Image 1.5 Image-to-Image High (Kie)", capabilities: ["image"], cost: 0.09, price: 0.11 },
  { id: "gpt-image-1.5-image-to-image-medium", displayName: "GPT Image 1.5 Image-to-Image Medium (Kie)", capabilities: ["image"], cost: 0.016, price: 0.02 },
  { id: "gpt-image-1.5-text-to-image-high", displayName: "GPT Image 1.5 Text-to-Image High (Kie)", capabilities: ["image"], cost: 0.09, price: 0.11 },
  { id: "gpt-image-1.5-text-to-image-medium", displayName: "GPT Image 1.5 Text-to-Image Medium (Kie)", capabilities: ["image"], cost: 0.016, price: 0.02 },

  // Google Imagen4
  { id: "google-imagen4", displayName: "Google Imagen4 (Kie)", capabilities: ["image"], cost: 0.032, price: 0.04 },

  // Gemini Omni Video series (billed per request flat-rate)
  { id: "gemini-omni-video-6s-4k-no-video-input", displayName: "Gemini Omni Video 6s 4K (No Video Input) (Kie)", capabilities: ["video"], cost: 1.00, price: 1.20 },
  { id: "gemini-omni-video-4k-with-video-input", displayName: "Gemini Omni Video 4K (With Video Input) (Kie)", capabilities: ["video"], cost: 1.50, price: 1.80 },
  { id: "gemini-omni-video-1080p-with-video-input", displayName: "Gemini Omni Video 1080p (With Video Input) (Kie)", capabilities: ["video"], cost: 1.00, price: 1.20 },
  { id: "gemini-omni-video-720p-with-video-input", displayName: "Gemini Omni Video 720p (With Video Input) (Kie)", capabilities: ["video"], cost: 1.00, price: 1.20 },
  { id: "gemini-omni-video-10s-4k-no-video-input", displayName: "Gemini Omni Video 10s 4K (No Video Input) (Kie)", capabilities: ["video"], cost: 1.25, price: 1.50 },
  { id: "gemini-omni-video-8s-4k-no-video-input", displayName: "Gemini Omni Video 8s 4K (No Video Input) (Kie)", capabilities: ["video"], cost: 1.125, price: 1.35 },
  { id: "gemini-omni-video-4s-4k-no-video-input", displayName: "Gemini Omni Video 4s 4K (No Video Input) (Kie)", capabilities: ["video"], cost: 0.875, price: 1.05 },
  { id: "gemini-omni-video-10s-1080p-no-video-input", displayName: "Gemini Omni Video 10s 1080p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.75, price: 0.90 },
  { id: "gemini-omni-video-8s-1080p-no-video-input", displayName: "Gemini Omni Video 8s 1080p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.625, price: 0.75 },
  { id: "gemini-omni-video-6s-1080p-no-video-input", displayName: "Gemini Omni Video 6s 1080p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.50, price: 0.60 },
  { id: "gemini-omni-video-4s-1080p-no-video-input", displayName: "Gemini Omni Video 4s 1080p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.375, price: 0.45 },
  { id: "gemini-omni-video-10s-720p-no-video-input", displayName: "Gemini Omni Video 10s 720p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.75, price: 0.90 },
  { id: "gemini-omni-video-8s-720p-no-video-input", displayName: "Gemini Omni Video 8s 720p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.625, price: 0.75 },
  { id: "gemini-omni-video-6s-720p-no-video-input", displayName: "Gemini Omni Video 6s 720p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.50, price: 0.60 },
  { id: "gemini-omni-video-4s-720p-no-video-input", displayName: "Gemini Omni Video 4s 720p (No Video Input) (Kie)", capabilities: ["video"], cost: 0.375, price: 0.45 },
];

async function main() {
  // 1. Find Kie provider
  let provider = await prisma.provider.findFirst({
    where: {
      OR: [
        { slug: "kie" },
        { name: { contains: "kie", mode: "insensitive" } },
        { baseUrl: { contains: "kie.ai", mode: "insensitive" } }
      ]
    }
  });

  if (!provider) {
    console.log("⚠️ Kie.ai provider not found in database. Automatically creating it...");
    provider = await prisma.provider.create({
      data: {
        name: "Kie.ai",
        slug: "kie",
        protocol: "OPENAI",
        baseUrl: "https://api.kie.ai/v1",
        isEnabled: true,
      }
    });
    console.log(`✅ Automatically created provider: ${provider.name} (slug: ${provider.slug})`);
  } else {
    console.log(`Found provider: ${provider.name} (id: ${provider.id}, slug: ${provider.slug})`);
  }

  let added = 0;
  let updated = 0;

  for (const m of multimodalModels) {
    const existing = await prisma.providerModel.findUnique({
      where: {
        providerId_modelId: {
          providerId: provider.id,
          modelId: m.id
        }
      }
    });

    if (existing) {
      // Update existing model configurations to ensure capabilities and pricing are active
      await prisma.providerModel.update({
        where: { id: existing.id },
        data: {
          displayName: m.displayName,
          capabilities: m.capabilities,
          costInputPer1k: m.cost,
          costOutputPer1k: (m as any).costOutput ?? 0,
          inputPricePer1k: m.price,
          outputPricePer1k: (m as any).priceOutput ?? 0,
          isEnabled: true, // auto-enable
        }
      });
      updated++;
      console.log(`[updated] ${m.displayName} (enabled)`);
    } else {
      // Create new model entry
      await prisma.providerModel.create({
        data: {
          providerId: provider.id,
          modelId: m.id,
          displayName: m.displayName,
          capabilities: m.capabilities,
          costInputPer1k: m.cost,
          costOutputPer1k: (m as any).costOutput ?? 0,
          inputPricePer1k: m.price,
          outputPricePer1k: (m as any).priceOutput ?? 0,
          isEnabled: true, // auto-enable for immediate availability
        }
      });
      added++;
      console.log(`[created] ${m.displayName} (enabled)`);
    }
  }

  console.log(`\n🎉 Success! Seeding finished. Added ${added} models, updated ${updated} models.`);
}

main()
  .catch((e) => {
    console.error("❌ Error executing seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
