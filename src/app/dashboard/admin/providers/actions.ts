"use server";

import { getPrisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { encryptSecret, decryptSecret, makeKeyHint } from "@/lib/crypto";
import { applyMargin, computeMargin, getPlatformSettings } from "@/lib/pricing";
import type { ProviderProtocol } from "@prisma/client";

// ----- Auth guard -----

async function ensureAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const prisma = getPrisma();
  let dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  // Fallback: lookup by email
  if (!dbUser && session.user.email) {
    dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
  }
  if (dbUser?.role !== "ADMIN") {
    throw new Error("Forbidden: Admin privileges required");
  }
  return prisma;
}

// ----- Types used by forms -----

export type ProviderInput = {
  id?: string;
  name: string;
  slug: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey?: string; // Optional: if empty on edit, keep existing
  logoUrl?: string;
  description?: string;
  isEnabled?: boolean;
  sortOrder?: number;
  extraHeaders?: Record<string, string> | null;
};

export type ProviderModelInput = {
  id?: string;
  providerId: string;
  modelId: string;
  displayName: string;
  description?: string;
  contextLength?: number;
  costInputPer1k?: number;
  costOutputPer1k?: number;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
  isEnabled?: boolean;
  sortOrder?: number;
  capabilities?: string[];
  /** If true, skip the minimum-margin check (dangerous; admin override). */
  allowBelowMinMargin?: boolean;
};

/** Throws if the selling prices violate the platform-wide minMarginPct floor. */
async function enforceMinMargin(
  input: ProviderModelInput,
  costInput: number,
  costOutput: number
) {
  if (input.allowBelowMinMargin) return;
  if (costInput <= 0 && costOutput <= 0) return; // no cost data => nothing to enforce
  const prisma = getPrisma();
  const settings = await getPlatformSettings(prisma);
  const margin = computeMargin({
    costInputPer1k: costInput,
    costOutputPer1k: costOutput,
    inputPricePer1k: input.inputPricePer1k ?? 0,
    outputPricePer1k: input.outputPricePer1k ?? 0,
  });
  if (margin !== null && margin < settings.minMarginPct) {
    const pct = (settings.minMarginPct * 100).toFixed(0);
    const got = (margin * 100).toFixed(1);
    throw new Error(
      `Margin ${got}% is below the platform minimum of ${pct}%. ` +
        `Either raise the selling price, lower the cost, or pass allowBelowMinMargin=true to override.`
    );
  }
}

// ----- Provider CRUD -----

export async function createProvider(input: ProviderInput) {
  try {
    const prisma = await ensureAdmin();
    if (!input.name?.trim() || !input.slug?.trim() || !input.baseUrl?.trim()) {
      throw new Error("Name, slug and baseUrl are required");
    }

    const existing = await prisma.provider.findUnique({ where: { slug: input.slug } });
    if (existing) throw new Error(`Slug "${input.slug}" is already in use`);

    const apiKeyCipher = input.apiKey ? encryptSecret(input.apiKey) : null;
    const apiKeyHint = input.apiKey ? makeKeyHint(input.apiKey) : null;

    const p = await prisma.provider.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        protocol: input.protocol,
        baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
        apiKeyCipher,
        apiKeyHint,
        logoUrl: input.logoUrl?.trim() || null,
        description: input.description?.trim() || null,
        isEnabled: input.isEnabled ?? true,
        sortOrder: input.sortOrder ?? 0,
        extraHeaders: (input.extraHeaders ?? null) as any,
      },
    });

    revalidatePath("/dashboard/admin/providers");
    return { success: true, id: p.id };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateProvider(input: ProviderInput) {
  try {
    if (!input.id) throw new Error("Provider id is required");
    const prisma = await ensureAdmin();

    const data: any = {
      name: input.name?.trim(),
      slug: input.slug?.trim().toLowerCase(),
      protocol: input.protocol,
      baseUrl: input.baseUrl?.trim().replace(/\/+$/, ""),
      logoUrl: input.logoUrl?.trim() || null,
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      extraHeaders: (input.extraHeaders ?? null) as any,
    };
    if (typeof input.isEnabled === "boolean") data.isEnabled = input.isEnabled;

    // Only rotate API key if a new non-empty value is provided
    if (input.apiKey && input.apiKey.trim()) {
      data.apiKeyCipher = encryptSecret(input.apiKey);
      data.apiKeyHint = makeKeyHint(input.apiKey);
    }

    await prisma.provider.update({ where: { id: input.id }, data });

    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteProvider(providerId: string) {
  try {
    const prisma = await ensureAdmin();
    await prisma.provider.delete({ where: { id: providerId } });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function toggleProviderEnabled(providerId: string, isEnabled: boolean) {
  try {
    const prisma = await ensureAdmin();
    await prisma.provider.update({ where: { id: providerId }, data: { isEnabled } });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ----- ProviderModel CRUD -----

export async function createProviderModel(input: ProviderModelInput) {
  try {
    const prisma = await ensureAdmin();
    if (!input.providerId || !input.modelId?.trim()) {
      throw new Error("providerId and modelId are required");
    }
    await enforceMinMargin(input, input.costInputPer1k ?? 0, input.costOutputPer1k ?? 0);

    const m = await prisma.providerModel.create({
      data: {
        providerId: input.providerId,
        modelId: input.modelId.trim(),
        displayName: input.displayName?.trim() || input.modelId.trim(),
        description: input.description?.trim() || null,
        contextLength: input.contextLength ?? null,
        costInputPer1k: input.costInputPer1k ?? 0,
        costOutputPer1k: input.costOutputPer1k ?? 0,
        inputPricePer1k: input.inputPricePer1k ?? 0,
        outputPricePer1k: input.outputPricePer1k ?? 0,
        isEnabled: input.isEnabled ?? true,
        sortOrder: input.sortOrder ?? 0,
        capabilities: input.capabilities ?? [],
      },
    });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true, id: m.id };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateProviderModel(input: ProviderModelInput) {
  try {
    if (!input.id) throw new Error("Model id is required");
    const prisma = await ensureAdmin();
    await enforceMinMargin(input, input.costInputPer1k ?? 0, input.costOutputPer1k ?? 0);

    await prisma.providerModel.update({
      where: { id: input.id },
      data: {
        modelId: input.modelId?.trim(),
        displayName: input.displayName?.trim(),
        description: input.description?.trim() || null,
        contextLength: input.contextLength ?? null,
        costInputPer1k: input.costInputPer1k ?? 0,
        costOutputPer1k: input.costOutputPer1k ?? 0,
        inputPricePer1k: input.inputPricePer1k ?? 0,
        outputPricePer1k: input.outputPricePer1k ?? 0,
        isEnabled: typeof input.isEnabled === "boolean" ? input.isEnabled : undefined,
        sortOrder: input.sortOrder ?? 0,
        capabilities: input.capabilities ?? [],
      },
    });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ----- Margin bulk operations -----

export async function applyMarginToProvider(providerId: string, marginPct?: number) {
  try {
    const prisma = await ensureAdmin();
    const settings = await getPlatformSettings(prisma);
    const pct = typeof marginPct === "number" ? marginPct : settings.defaultMarginPct;
    if (pct < settings.minMarginPct) {
      throw new Error(
        `Margin ${(pct * 100).toFixed(0)}% is below the enforced minimum of ${(
          settings.minMarginPct * 100
        ).toFixed(0)}%.`
      );
    }

    const models = await prisma.providerModel.findMany({ where: { providerId } });
    let updated = 0;
    for (const m of models) {
      if (m.costInputPer1k <= 0 && m.costOutputPer1k <= 0) continue;
      const { inputPricePer1k, outputPricePer1k } = applyMargin(
        m.costInputPer1k,
        m.costOutputPer1k,
        pct
      );
      await prisma.providerModel.update({
        where: { id: m.id },
        data: { inputPricePer1k, outputPricePer1k },
      });
      updated++;
    }
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true, message: `Applied ${(pct * 100).toFixed(0)}% margin to ${updated} models` };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function applyMarginToModel(modelId: string, marginPct?: number) {
  try {
    const prisma = await ensureAdmin();
    const settings = await getPlatformSettings(prisma);
    const pct = typeof marginPct === "number" ? marginPct : settings.defaultMarginPct;
    if (pct < settings.minMarginPct) {
      throw new Error(`Margin below platform minimum.`);
    }
    const m = await prisma.providerModel.findUnique({ where: { id: modelId } });
    if (!m) throw new Error("Model not found");
    if (m.costInputPer1k <= 0 && m.costOutputPer1k <= 0) {
      throw new Error("Cannot auto-price: model has no cost configured");
    }
    const prices = applyMargin(m.costInputPer1k, m.costOutputPer1k, pct);
    await prisma.providerModel.update({ where: { id: modelId }, data: prices });
    revalidatePath("/dashboard/admin/providers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ----- Platform settings -----

export async function updatePlatformSettings(input: {
  defaultMarginPct: number;
  minMarginPct: number;
  autoApplyMargin: boolean;
}) {
  try {
    const prisma = await ensureAdmin();
    if (input.minMarginPct < 0 || input.minMarginPct > 10) {
      throw new Error("minMarginPct out of range (0..10)");
    }
    if (input.defaultMarginPct < input.minMarginPct) {
      throw new Error("defaultMarginPct cannot be below minMarginPct");
    }
    await prisma.platformSetting.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        defaultMarginPct: input.defaultMarginPct,
        minMarginPct: input.minMarginPct,
        autoApplyMargin: input.autoApplyMargin,
      },
      update: {
        defaultMarginPct: input.defaultMarginPct,
        minMarginPct: input.minMarginPct,
        autoApplyMargin: input.autoApplyMargin,
      },
    });
    revalidatePath("/dashboard/admin/providers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export type PaymentSettingsInput = {
  paypalMode?: string;
  paypalClientId?: string;
  paypalSecret?: string;
  alipayAppId?: string;
  alipayPublicKey?: string;
  alipayPrivateKey?: string;
};

export async function updatePaymentSettings(input: PaymentSettingsInput) {
  try {
    const prisma = await ensureAdmin();
    const data: any = {};
    
    if (input.paypalMode !== undefined) data.paypalMode = input.paypalMode;
    if (input.paypalClientId !== undefined) data.paypalClientId = input.paypalClientId;
    if (input.paypalSecret) data.paypalSecretCipher = encryptSecret(input.paypalSecret);
    
    if (input.alipayAppId !== undefined) data.alipayAppId = input.alipayAppId;
    if (input.alipayPublicKey !== undefined) data.alipayPublicKey = input.alipayPublicKey;
    if (input.alipayPrivateKey) data.alipayPrivateKeyCipher = encryptSecret(input.alipayPrivateKey);

    await prisma.platformSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    revalidatePath("/dashboard/admin/providers");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteProviderModel(modelId: string) {
  try {
    const prisma = await ensureAdmin();
    await prisma.providerModel.delete({ where: { id: modelId } });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function toggleProviderModelEnabled(modelId: string, isEnabled: boolean) {
  try {
    const prisma = await ensureAdmin();
    await prisma.providerModel.update({ where: { id: modelId }, data: { isEnabled } });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function toggleBulkModelsEnabled(providerId: string, isEnabled: boolean) {
  try {
    const prisma = await ensureAdmin();
    await prisma.providerModel.updateMany({
      where: { providerId },
      data: { isEnabled }
    });
    revalidatePath("/dashboard/admin/providers");
    revalidatePath("/dashboard/models");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ----- Test Connection -----

export async function testProviderConnection(providerId: string) {
  try {
    const prisma = await ensureAdmin();
    const p = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!p) throw new Error("Provider not found");
    if (!p.apiKeyCipher) throw new Error("Provider has no API key configured");

    const apiKey = decryptSecret(p.apiKeyCipher);
    const base = p.baseUrl.replace(/\/+$/, "");

    const isKie = p.slug.toLowerCase() === "kie" || base.includes("kie.ai");
    if (isKie) {
      // Test Kie.ai using its credit query endpoint which requires Bearer token auth
      const cleanBase = base.replace(/\/v1$/, ""); // Remove trailing /v1 if present to target the root API path
      const res = await fetch(`${cleanBase}/api/v1/chat/credit`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(p.extraHeaders as Record<string, string> | null ?? {}),
        },
      });
      if (!res.ok) {
        // Try absolute fallback URL to make sure we reach the correct root URL
        const fallbackRes = await fetch("https://api.kie.ai/api/v1/chat/credit", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });
        if (!fallbackRes.ok) {
          const text = await fallbackRes.text();
          throw new Error(`Kie.ai Authentication Failed (HTTP ${fallbackRes.status}): ${text.slice(0, 100)}`);
        }
      }
      return { success: true, message: `OK - Successfully connected to Kie.ai (API Key is valid)` };
    }

    if (p.protocol === "OPENAI") {
      const res = await fetch(`${base}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(p.extraHeaders as Record<string, string> | null ?? {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      return { success: true, message: `OK - ${count} models available` };
    }

    if (p.protocol === "ANTHROPIC") {
      // Anthropic exposes /v1/models
      const res = await fetch(`${base}/models`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...(p.extraHeaders as Record<string, string> | null ?? {}),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      return { success: true, message: `OK - ${count} models available` };
    }

    if (p.protocol === "GEMINI") {
      const url = `${base}/models?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const count = Array.isArray(data?.models) ? data.models.length : 0;
      return { success: true, message: `OK - ${count} models available` };
    }

    throw new Error(`Unsupported protocol: ${p.protocol}`);
  } catch (err: any) {
    return { error: err.message };
  }
}

// ----- Auto-import models from upstream /models endpoint -----

type UpstreamModel = {
  id: string;
  displayName?: string;
  contextLength?: number;
  costInputPer1k?: number;  // Upstream cost per 1k input tokens (USD)
  costOutputPer1k?: number; // Upstream cost per 1k output tokens (USD)
  inputPricePer1k?: number;  // Platform direct selling price override (USD per 1k)
  outputPricePer1k?: number; // Platform direct selling price override (USD per 1k)
  capabilities?: string[];
};

export async function importProviderModels(providerId: string) {
  try {
    const prisma = await ensureAdmin();
    const p = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!p) throw new Error("Provider not found");
    if (!p.apiKeyCipher) throw new Error("Provider has no API key configured");

    const settings = await getPlatformSettings(prisma);
    const apiKey = decryptSecret(p.apiKeyCipher);
    const base = p.baseUrl.replace(/\/+$/, "");

    let upstreamModels: UpstreamModel[] = [];

    const isKie = p.slug.toLowerCase() === "kie" || base.includes("kie.ai");

    if (isKie) {
      try {
        // Try fetching live models from Kie.ai's dynamic /models endpoint first
        const res = await fetch(`${base}/models`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(p.extraHeaders as Record<string, string> | null ?? {}),
          },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.data) && data.data.length > 0) {
            upstreamModels = data.data.map((m: any) => {
              // Parse pricing structures
              const promptPrice = m.pricing?.prompt !== undefined ? Number(m.pricing.prompt) : 0;
              const completionPrice = m.pricing?.completion !== undefined ? Number(m.pricing.completion) : 0;

              // Extract or infer capabilities for capability-based filtering
              const caps: string[] = [];
              if (m.capabilities && Array.isArray(m.capabilities)) {
                caps.push(...m.capabilities);
              } else {
                const idLower = m.id.toLowerCase();
                if (idLower.includes("flux") || idLower.includes("mj") || idLower.includes("midjourney") || idLower.includes("imagen") || idLower.includes("banana")) {
                  caps.push("image");
                } else if (idLower.includes("kling") || idLower.includes("runway") || idLower.includes("veo") || idLower.includes("seedance") || idLower.includes("video")) {
                  caps.push("video");
                } else if (idLower.includes("suno") || idLower.includes("music")) {
                  caps.push("music");
                }
              }

              return {
                id: m.id,
                displayName: m.display_name || m.id,
                contextLength: m.context_length || null,
                costInputPer1k: promptPrice,
                costOutputPer1k: completionPrice,
                capabilities: caps,
              };
            });
            console.log(`Successfully fetched ${upstreamModels.length} models dynamically from Kie.ai API.`);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch models dynamically from Kie.ai, falling back to static list:", err);
      }

      if (upstreamModels.length === 0) {
        // Pre-configured model list for Kie.ai
        upstreamModels = [
        // OpenAI
        { id: "gpt-4o", displayName: "GPT-4o (Kie)", contextLength: 128000, costInputPer1k: 0.0025, costOutputPer1k: 0.010 },
        { id: "gpt-4o-mini", displayName: "GPT-4o-mini (Kie)", contextLength: 128000, costInputPer1k: 0.00015, costOutputPer1k: 0.0006 },
        { id: "o1", displayName: "OpenAI o1 (Kie)", contextLength: 200000, costInputPer1k: 0.015, costOutputPer1k: 0.060 },
        { id: "o1-mini", displayName: "OpenAI o1-mini (Kie)", contextLength: 128000, costInputPer1k: 0.003, costOutputPer1k: 0.012 },
        { id: "o3-mini", displayName: "OpenAI o3-mini (Kie)", contextLength: 200000, costInputPer1k: 0.0011, costOutputPer1k: 0.0044 },

        // Anthropic
        { id: "claude-3-5-sonnet", displayName: "Claude 3.5 Sonnet (Kie)", contextLength: 200000, costInputPer1k: 0.003, costOutputPer1k: 0.015 },
        { id: "claude-3-5-haiku", displayName: "Claude 3.5 Haiku (Kie)", contextLength: 200000, costInputPer1k: 0.0008, costOutputPer1k: 0.004 },
        { id: "claude-3-opus", displayName: "Claude 3 Opus (Kie)", contextLength: 200000, costInputPer1k: 0.015, costOutputPer1k: 0.075 },

        // DeepSeek
        { id: "deepseek-chat", displayName: "DeepSeek V3 (Kie)", contextLength: 64000, costInputPer1k: 0.00014, costOutputPer1k: 0.00028 },
        { id: "deepseek-r1", displayName: "DeepSeek R1 (Kie)", contextLength: 64000, costInputPer1k: 0.00055, costOutputPer1k: 0.00219 },

        // Google Gemini
        { id: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro (Kie)", contextLength: 2097152, costInputPer1k: 0.00125, costOutputPer1k: 0.005 },
        { id: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash (Kie)", contextLength: 1048576, costInputPer1k: 0.000075, costOutputPer1k: 0.0003 },
        { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash (Kie)", contextLength: 1048576, costInputPer1k: 0.000075, costOutputPer1k: 0.0003 },
        { id: "gemini-2.0-flash-thinking", displayName: "Gemini 2.0 Flash Thinking (Kie)", contextLength: 1048576, costInputPer1k: 0.000075, costOutputPer1k: 0.0003 },

        // Advanced Next-Gen LLMs (Kie.ai)
        { id: "claude-opus-4.7", displayName: "Claude 4.7 Opus (Kie)", contextLength: 200000, costInputPer1k: 0.001425, costOutputPer1k: 0.007150, inputPricePer1k: 0.001425, outputPricePer1k: 0.007150 },
        { id: "claude-sonnet-4.6", displayName: "Claude 4.6 Sonnet (Kie)", contextLength: 200000, costInputPer1k: 0.000850, costOutputPer1k: 0.004275, inputPricePer1k: 0.000850, outputPricePer1k: 0.004275 },
        { id: "gpt-5.5-chat", displayName: "GPT-5.5 Chat (Kie)", contextLength: 200000, costInputPer1k: 0.001400, costOutputPer1k: 0.008400, inputPricePer1k: 0.001400, outputPricePer1k: 0.008400 },

        // Multimodal Models (Kie.ai Native)
        { id: "flux-schnell", displayName: "Flux Schnell (Kie)", capabilities: ["image"], costInputPer1k: 0.05 },
        { id: "flux-dev", displayName: "Flux Dev (Kie)", capabilities: ["image"], costInputPer1k: 0.10 },
        { id: "flux-pro", displayName: "Flux Pro (Kie)", capabilities: ["image"], costInputPer1k: 0.15 },
        { id: "midjourney", displayName: "Midjourney v6 (Kie)", capabilities: ["image"], costInputPer1k: 0.20 },
        { id: "kling", displayName: "Kling Video (Kie)", capabilities: ["video"], costInputPer1k: 0.25 },
        { id: "runway", displayName: "Runway Gen-3 (Kie)", capabilities: ["video"], costInputPer1k: 0.30 },
        { id: "suno", displayName: "Suno AI Music v3.5 (Kie)", capabilities: ["music"], costInputPer1k: 0.15 },

        // Google Nano Banana series (Kie.ai Image)
        { id: "google-nano-banana-2-4k", displayName: "Google Nano Banana 2 4K (Kie)", capabilities: ["image"], costInputPer1k: 0.09 },
        { id: "google-nano-banana-2-2k", displayName: "Google Nano Banana 2 2K (Kie)", capabilities: ["image"], costInputPer1k: 0.06 },
        { id: "google-nano-banana-2-1k", displayName: "Google Nano Banana 2 1K (Kie)", capabilities: ["image"], costInputPer1k: 0.04 },
        { id: "google-nano-banana-pro-1-2k", displayName: "Google Nano Banana Pro 1/2K (Kie)", capabilities: ["image"], costInputPer1k: 0.09 },
        { id: "google-nano-banana-pro-4k", displayName: "Google Nano Banana Pro 4K (Kie)", capabilities: ["image"], costInputPer1k: 0.12 },

        // Seedance 2.0 Video series (Kie.ai Video)
        { id: "seedance-2.0-720p-no-video-input", displayName: "Seedance 2.0 720p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.205 },
        { id: "seedance-2.0-720p-with-video-input", displayName: "Seedance 2.0 720p (With Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.125 },
        { id: "seedance-2.0-480p-no-video-input", displayName: "Seedance 2.0 480p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.095 },
        { id: "seedance-2.0-480p-with-video-input", displayName: "Seedance 2.0 480p (With Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.057 },

        // Google Veo 3.1 series (Kie.ai Video)
        { id: "google-veo-3.1-text-to-video-quality-1080p", displayName: "Google Veo 3.1 Text-to-Video 1080p (Kie)", capabilities: ["video"], costInputPer1k: 1.28 },
        { id: "google-veo-3.1-image-to-video-quality-1080p", displayName: "Google Veo 3.1 Image-to-Video 1080p (Kie)", capabilities: ["video"], costInputPer1k: 1.28 },
        { id: "google-veo-3.1-text-to-video-quality-4k", displayName: "Google Veo 3.1 Text-to-Video 4K (Kie)", capabilities: ["video"], costInputPer1k: 1.85 },
        { id: "google-veo-3.1-image-to-video-quality-4k", displayName: "Google Veo 3.1 Image-to-Video 4K (Kie)", capabilities: ["video"], costInputPer1k: 1.85 },

        // Grok Imagine Video series (Kie.ai Video)
        { id: "grok-imagine-image-to-video-720p", displayName: "Grok Imagine Image-to-Video 720p (Kie)", capabilities: ["video"], costInputPer1k: 0.015 },
        { id: "grok-imagine-text-to-video-720p", displayName: "Grok Imagine Text-to-Video 720p (Kie)", capabilities: ["video"], costInputPer1k: 0.015 },
        { id: "grok-imagine-image-to-video-480p", displayName: "Grok Imagine Image-to-Video 480p (Kie)", capabilities: ["video"], costInputPer1k: 0.008 },
        { id: "grok-imagine-text-to-video-480p", displayName: "Grok Imagine Text-to-Video 480p (Kie)", capabilities: ["video"], costInputPer1k: 0.008 },

        // Gemini 2.5 Flash / Pro (Direct Overrides)
        { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash (Kie)", contextLength: 1048576, costInputPer1k: 0.000075, costOutputPer1k: 0.000300, inputPricePer1k: 0.000090, outputPricePer1k: 0.000750 },
        { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro (Kie)", contextLength: 2097152, costInputPer1k: 0.000300, costOutputPer1k: 0.002400, inputPricePer1k: 0.000380, outputPricePer1k: 0.003000 },

        // Topaz Image Upscaler
        { id: "topaz-image-upscaler-8k", displayName: "Topaz Image Upscaler 8K (Kie)", capabilities: ["image"], costInputPer1k: 0.16, inputPricePer1k: 0.20 },
        { id: "topaz-image-upscaler-4k", displayName: "Topaz Image Upscaler 4K (Kie)", capabilities: ["image"], costInputPer1k: 0.08, inputPricePer1k: 0.10 },
        { id: "topaz-image-upscaler-2k", displayName: "Topaz Image Upscaler 2K (Kie)", capabilities: ["image"], costInputPer1k: 0.04, inputPricePer1k: 0.05 },

        // Kling 2.6 Motion Control (billed per request/video flat-rate based on average duration)
        { id: "kling-2.6-motion-control-1080p", displayName: "Kling 2.6 Motion Control 1080P (Kie)", capabilities: ["video"], costInputPer1k: 0.36, inputPricePer1k: 0.45 },
        { id: "kling-2.6-motion-control-720p", displayName: "Kling 2.6 Motion Control 720P (Kie)", capabilities: ["video"], costInputPer1k: 0.22, inputPricePer1k: 0.275 },

        // GPT Image 1.5
        { id: "gpt-image-1.5-image-to-image-high", displayName: "GPT Image 1.5 Image-to-Image High (Kie)", capabilities: ["image"], costInputPer1k: 0.09, inputPricePer1k: 0.11 },
        { id: "gpt-image-1.5-image-to-image-medium", displayName: "GPT Image 1.5 Image-to-Image Medium (Kie)", capabilities: ["image"], costInputPer1k: 0.016, inputPricePer1k: 0.02 },
        { id: "gpt-image-1.5-text-to-image-high", displayName: "GPT Image 1.5 Text-to-Image High (Kie)", capabilities: ["image"], costInputPer1k: 0.09, inputPricePer1k: 0.11 },
        { id: "gpt-image-1.5-text-to-image-medium", displayName: "GPT Image 1.5 Text-to-Image Medium (Kie)", capabilities: ["image"], costInputPer1k: 0.016, inputPricePer1k: 0.02 },

        // GPT Image 2
        { id: "gpt-image-2", displayName: "GPT Image 2 (Kie)", capabilities: ["image"], costInputPer1k: 0.024, inputPricePer1k: 0.03 },

        // Google Imagen4
        { id: "google-imagen4", displayName: "Google Imagen4 (Kie)", capabilities: ["image"], costInputPer1k: 0.032, inputPricePer1k: 0.04 },

        // Gemini Omni Video series (billed per request flat-rate)
        { id: "gemini-omni-video-6s-4k-no-video-input", displayName: "Gemini Omni Video 6s 4K (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.00, inputPricePer1k: 1.20 },
        { id: "gemini-omni-video-4k-with-video-input", displayName: "Gemini Omni Video 4K (With Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.50, inputPricePer1k: 1.80 },
        { id: "gemini-omni-video-1080p-with-video-input", displayName: "Gemini Omni Video 1080p (With Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.00, inputPricePer1k: 1.20 },
        { id: "gemini-omni-video-720p-with-video-input", displayName: "Gemini Omni Video 720p (With Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.00, inputPricePer1k: 1.20 },
        { id: "gemini-omni-video-10s-4k-no-video-input", displayName: "Gemini Omni Video 10s 4K (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.25, inputPricePer1k: 1.50 },
        { id: "gemini-omni-video-8s-4k-no-video-input", displayName: "Gemini Omni Video 8s 4K (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 1.125, inputPricePer1k: 1.35 },
        { id: "gemini-omni-video-4s-4k-no-video-input", displayName: "Gemini Omni Video 4s 4K (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.875, inputPricePer1k: 1.05 },
        { id: "gemini-omni-video-10s-1080p-no-video-input", displayName: "Gemini Omni Video 10s 1080p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.75, inputPricePer1k: 0.90 },
        { id: "gemini-omni-video-8s-1080p-no-video-input", displayName: "Gemini Omni Video 8s 1080p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.625, inputPricePer1k: 0.75 },
        { id: "gemini-omni-video-6s-1080p-no-video-input", displayName: "Gemini Omni Video 6s 1080p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.50, inputPricePer1k: 0.60 },
        { id: "gemini-omni-video-4s-1080p-no-video-input", displayName: "Gemini Omni Video 4s 1080p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.375, inputPricePer1k: 0.45 },
        { id: "gemini-omni-video-10s-720p-no-video-input", displayName: "Gemini Omni Video 10s 720p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.75, inputPricePer1k: 0.90 },
        { id: "gemini-omni-video-8s-720p-no-video-input", displayName: "Gemini Omni Video 8s 720p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.625, inputPricePer1k: 0.75 },
        { id: "gemini-omni-video-6s-720p-no-video-input", displayName: "Gemini Omni Video 6s 720p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.50, inputPricePer1k: 0.60 },
        { id: "gemini-omni-video-4s-720p-no-video-input", displayName: "Gemini Omni Video 4s 720p (No Video Input) (Kie)", capabilities: ["video"], costInputPer1k: 0.375, inputPricePer1k: 0.45 },
      ];
    }
  } else if (p.protocol === "OPENAI") {
      const res = await fetch(`${base}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(p.extraHeaders as Record<string, string> | null ?? {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      upstreamModels = (data.data || []).map((m: any) => {
        // OpenRouter exposes pricing: { prompt: "0.0000015", completion: "0.000002" } (per token, string!)
        const promptPerToken = m.pricing?.prompt ? Number(m.pricing.prompt) : undefined;
        const completionPerToken = m.pricing?.completion ? Number(m.pricing.completion) : undefined;
        return {
          id: m.id,
          displayName: m.name || m.id,
          contextLength: m.context_length ?? m.context_window ?? undefined,
          costInputPer1k: promptPerToken != null ? promptPerToken * 1000 : undefined,
          costOutputPer1k: completionPerToken != null ? completionPerToken * 1000 : undefined,
        };
      });
    } else if (p.protocol === "ANTHROPIC") {
      const res = await fetch(`${base}/models`, {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          ...(p.extraHeaders as Record<string, string> | null ?? {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      upstreamModels = (data.data || []).map((m: any) => ({
        id: m.id,
        displayName: m.display_name || m.id,
      }));
    } else if (p.protocol === "GEMINI") {
      const res = await fetch(`${base}/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      upstreamModels = (data.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m: any) => ({
          id: String(m.name || "").replace(/^models\//, ""),
          displayName: m.displayName || m.name,
          contextLength: m.inputTokenLimit ?? undefined,
        }));
    } else {
      throw new Error(`Unsupported protocol: ${p.protocol}`);
    }

    let synced = 0;
    for (const m of upstreamModels) {
      if (!m.id) continue;
      const costIn = m.costInputPer1k ?? 0;
      const costOut = m.costOutputPer1k ?? 0;

      let inputPrice = m.inputPricePer1k;
      let outputPrice = m.outputPricePer1k;
      if (inputPrice === undefined || outputPrice === undefined) {
        const prices =
          settings.autoApplyMargin && (costIn > 0 || costOut > 0)
            ? applyMargin(costIn, costOut, settings.defaultMarginPct)
            : { inputPricePer1k: 0, outputPricePer1k: 0 };
        if (inputPrice === undefined) inputPrice = prices.inputPricePer1k;
        if (outputPrice === undefined) outputPrice = prices.outputPricePer1k;
      }

      await prisma.providerModel.upsert({
        where: {
          providerId_modelId: {
            providerId: p.id,
            modelId: m.id,
          },
        },
        update: {
          displayName: m.displayName || m.id,
          contextLength: m.contextLength ?? null,
          costInputPer1k: costIn,
          costOutputPer1k: costOut,
          inputPricePer1k: inputPrice,
          outputPricePer1k: outputPrice,
          capabilities: m.capabilities || [],
          ...(isKie ? { isEnabled: true } : {}),
        },
        create: {
          providerId: p.id,
          modelId: m.id,
          displayName: m.displayName || m.id,
          contextLength: m.contextLength ?? null,
          costInputPer1k: costIn,
          costOutputPer1k: costOut,
          inputPricePer1k: inputPrice,
          outputPricePer1k: outputPrice,
          capabilities: m.capabilities || [],
          isEnabled: isKie ? true : false,
        },
      });
      synced++;
    }

    revalidatePath("/dashboard/admin/providers");
    return {
      success: true,
      message: `Successfully synchronized ${synced} models for ${p.name}. Auto-applied ${(settings.defaultMarginPct * 100).toFixed(0)}% margin where cost was known. KIE models were automatically enabled!`,
    };
  } catch (err: any) {
    return { error: err.message };
  }
}
