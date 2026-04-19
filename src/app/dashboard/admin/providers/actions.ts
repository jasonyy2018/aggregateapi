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

// ----- Test Connection -----

export async function testProviderConnection(providerId: string) {
  try {
    const prisma = await ensureAdmin();
    const p = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!p) throw new Error("Provider not found");
    if (!p.apiKeyCipher) throw new Error("Provider has no API key configured");

    const apiKey = decryptSecret(p.apiKeyCipher);
    const base = p.baseUrl.replace(/\/+$/, "");

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

    if (p.protocol === "OPENAI") {
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

    let added = 0;
    let skipped = 0;
    for (const m of upstreamModels) {
      if (!m.id) continue;
      const costIn = m.costInputPer1k ?? 0;
      const costOut = m.costOutputPer1k ?? 0;
      // Auto-apply default margin if we know the cost
      const prices =
        settings.autoApplyMargin && (costIn > 0 || costOut > 0)
          ? applyMargin(costIn, costOut, settings.defaultMarginPct)
          : { inputPricePer1k: 0, outputPricePer1k: 0 };
      try {
        await prisma.providerModel.create({
          data: {
            providerId: p.id,
            modelId: m.id,
            displayName: m.displayName || m.id,
            contextLength: m.contextLength ?? null,
            costInputPer1k: costIn,
            costOutputPer1k: costOut,
            inputPricePer1k: prices.inputPricePer1k,
            outputPricePer1k: prices.outputPricePer1k,
            isEnabled: false, // import as disabled by default - admin must explicitly enable
          },
        });
        added++;
      } catch {
        skipped++; // Unique constraint => already exists
      }
    }

    revalidatePath("/dashboard/admin/providers");
    return {
      success: true,
      message: `Imported ${added}, skipped ${skipped} (already exist). Auto-applied ${(settings.defaultMarginPct * 100).toFixed(0)}% margin where cost was known.`,
    };
  } catch (err: any) {
    return { error: err.message };
  }
}
