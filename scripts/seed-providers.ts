/**
 * Seed a few common LLM providers and a handful of popular models per provider,
 * so admins can start managing them immediately. All items are created DISABLED
 * so nothing goes live until the admin explicitly flips the switch.
 *
 * Run with:
 *   npx tsx scripts/seed-providers.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Seed = {
  name: string;
  slug: string;
  protocol: "OPENAI" | "ANTHROPIC" | "GEMINI";
  baseUrl: string;
  description?: string;
  models: {
    modelId: string;
    displayName: string;
    contextLength?: number;
    inputPricePer1k?: number;
    outputPricePer1k?: number;
    capabilities?: string[];
  }[];
};

const seeds: Seed[] = [
  {
    name: "OpenAI",
    slug: "openai",
    protocol: "OPENAI",
    baseUrl: "https://api.openai.com/v1",
    description: "OpenAI official API (GPT-4o family, o-series, embeddings).",
    models: [
      { modelId: "gpt-4o", displayName: "GPT-4o", contextLength: 128000, inputPricePer1k: 0.005, outputPricePer1k: 0.015, capabilities: ["vision", "tools"] },
      { modelId: "gpt-4o-mini", displayName: "GPT-4o mini", contextLength: 128000, inputPricePer1k: 0.00015, outputPricePer1k: 0.0006, capabilities: ["vision", "tools"] },
      { modelId: "o3-mini", displayName: "o3-mini", contextLength: 200000, inputPricePer1k: 0.0011, outputPricePer1k: 0.0044, capabilities: ["reasoning"] },
    ],
  },
  {
    name: "Anthropic",
    slug: "anthropic",
    protocol: "ANTHROPIC",
    baseUrl: "https://api.anthropic.com/v1",
    description: "Anthropic Claude models (native /v1/messages protocol).",
    models: [
      { modelId: "claude-opus-4-20250514", displayName: "Claude Opus 4", contextLength: 200000, inputPricePer1k: 0.015, outputPricePer1k: 0.075, capabilities: ["vision", "tools"] },
      { modelId: "claude-sonnet-4-20250514", displayName: "Claude Sonnet 4", contextLength: 200000, inputPricePer1k: 0.003, outputPricePer1k: 0.015, capabilities: ["vision", "tools"] },
      { modelId: "claude-3-5-haiku-latest", displayName: "Claude 3.5 Haiku", contextLength: 200000, inputPricePer1k: 0.0008, outputPricePer1k: 0.004 },
    ],
  },
  {
    name: "Google Gemini",
    slug: "gemini",
    protocol: "GEMINI",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    description: "Google Generative AI (generateContent protocol).",
    models: [
      { modelId: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", contextLength: 1048576, inputPricePer1k: 0.00125, outputPricePer1k: 0.005, capabilities: ["vision", "tools"] },
      { modelId: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", contextLength: 1048576, inputPricePer1k: 0.000075, outputPricePer1k: 0.0003, capabilities: ["vision"] },
    ],
  },
  {
    name: "OpenRouter",
    slug: "openrouter",
    protocol: "OPENAI",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "OpenRouter aggregator (OpenAI-compatible, hundreds of models).",
    models: [
      { modelId: "openai/gpt-4o", displayName: "GPT-4o (via OpenRouter)", contextLength: 128000 },
      { modelId: "anthropic/claude-3.5-sonnet", displayName: "Claude 3.5 Sonnet (via OpenRouter)", contextLength: 200000 },
    ],
  },
  {
    name: "DeepSeek",
    slug: "deepseek",
    protocol: "OPENAI",
    baseUrl: "https://api.deepseek.com/v1",
    description: "DeepSeek official API (OpenAI-compatible).",
    models: [
      { modelId: "deepseek-chat", displayName: "DeepSeek Chat", contextLength: 65536, inputPricePer1k: 0.00014, outputPricePer1k: 0.00028 },
      { modelId: "deepseek-reasoner", displayName: "DeepSeek Reasoner", contextLength: 65536, inputPricePer1k: 0.00055, outputPricePer1k: 0.00219, capabilities: ["reasoning"] },
    ],
  },
];

async function main() {
  let added = 0;
  let skipped = 0;
  for (const s of seeds) {
    const existing = await prisma.provider.findUnique({ where: { slug: s.slug } });
    if (existing) {
      console.log(`[skip] provider '${s.slug}' already exists`);
      skipped++;
      continue;
    }
    await prisma.provider.create({
      data: {
        name: s.name,
        slug: s.slug,
        protocol: s.protocol,
        baseUrl: s.baseUrl,
        description: s.description,
        isEnabled: false, // require admin to add API key + enable
        sortOrder: added,
        models: {
          create: s.models.map((m, i) => ({
            modelId: m.modelId,
            displayName: m.displayName,
            contextLength: m.contextLength ?? null,
            inputPricePer1k: m.inputPricePer1k ?? 0,
            outputPricePer1k: m.outputPricePer1k ?? 0,
            capabilities: m.capabilities ?? [],
            isEnabled: false,
            sortOrder: i,
          })),
        },
      },
    });
    added++;
    console.log(`[ok]   provider '${s.slug}' seeded with ${s.models.length} models`);
  }
  console.log(`\nDone. Added ${added} providers, skipped ${skipped}.`);
  console.log("Remember to set the API key and flip the Enabled switch in /dashboard/admin/providers.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
