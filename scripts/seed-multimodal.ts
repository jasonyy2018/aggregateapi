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
  { id: "flux-schnell", displayName: "Flux Schnell (Kie)", capabilities: ["image"], cost: 0.05, price: 0.06 },
  { id: "flux-dev", displayName: "Flux Dev (Kie)", capabilities: ["image"], cost: 0.10, price: 0.12 },
  { id: "flux-pro", displayName: "Flux Pro (Kie)", capabilities: ["image"], cost: 0.15, price: 0.18 },
  { id: "midjourney", displayName: "Midjourney v6 (Kie)", capabilities: ["image"], cost: 0.20, price: 0.24 },
  { id: "kling", displayName: "Kling Video (Kie)", capabilities: ["video"], cost: 0.25, price: 0.30 },
  { id: "runway", displayName: "Runway Gen-3 (Kie)", capabilities: ["video"], cost: 0.30, price: 0.36 },
  { id: "suno", displayName: "Suno AI Music v3.5 (Kie)", capabilities: ["music"], cost: 0.15, price: 0.18 },
];

async function main() {
  // 1. Find Kie provider
  const provider = await prisma.provider.findFirst({
    where: {
      OR: [
        { slug: "kie" },
        { name: { contains: "kie", mode: "insensitive" } },
        { baseUrl: { contains: "kie.ai", mode: "insensitive" } }
      ]
    }
  });

  if (!provider) {
    console.error("❌ Error: Could not find Kie.ai provider in the database. Please add Kie.ai as a provider in your admin dashboard first.");
    process.exit(1);
  }

  console.log(`Found provider: ${provider.name} (id: ${provider.id}, slug: ${provider.slug})`);

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
          inputPricePer1k: m.price,
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
          costOutputPer1k: 0,
          inputPricePer1k: m.price,
          outputPricePer1k: 0,
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
