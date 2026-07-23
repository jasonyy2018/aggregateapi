/**
 * Shared utilities used across API routes and admin actions.
 *
 * Centralizes:
 * - Model resolution (slug/modelId → Provider + ProviderModel)
 * - OpenAI-compatible error responses
 * - Billing wrapper
 * - Admin authorization guard
 * - Cost calculation helpers
 */

import { NextResponse } from "next/server";
import { getPrisma } from "./prisma";
import { auth } from "@/auth";
import { chargeUserWithSubscription } from "./billing";
import type { OpenAIChatBody } from "./llm-gateway";

/**
 * Normalizes a provider's base URL to a clean root domain without trailing /v1 or /api paths.
 * Prevents URL path duplication (e.g. /api/api/v1/jobs/createTask).
 */
export function getCleanDomainBase(baseUrl: string): string {
  let clean = baseUrl.trim();
  while (clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  while (clean.endsWith("/v1") || clean.endsWith("/api")) {
    if (clean.endsWith("/v1")) clean = clean.slice(0, -3);
    if (clean.endsWith("/api")) clean = clean.slice(0, -4);
    while (clean.endsWith("/")) {
      clean = clean.slice(0, -1);
    }
  }
  return clean;
}

// ─── Model Resolution ────────────────────────────────────────────────────────

interface ResolvedModel {
  provider: import("@prisma/client").Provider;
  model: import("@prisma/client").ProviderModel;
}

/**
 * Resolve a requested model string to a database Provider + ProviderModel pair.
 * Supports two addressing schemes:
 *   - "provider-slug/model-id" (explicit targeting)
 *   - "model-id" (first enabled match globally)
 */
export async function resolveModel(
  prisma: ReturnType<typeof getPrisma>,
  requested: string
): Promise<ResolvedModel | null> {
  // 1. Try "slug/modelId" form
  const slashIdx = requested.indexOf("/");
  if (slashIdx > 0) {
    const slug = requested.slice(0, slashIdx);
    const modelId = requested.slice(slashIdx + 1);
    const prov = await prisma.provider.findUnique({ where: { slug } });
    if (prov && prov.isEnabled) {
      const m = await prisma.providerModel.findFirst({
        where: { providerId: prov.id, modelId, isEnabled: true },
      });
      if (m) return { provider: prov, model: m };
    }
  }
  // 2. Fallback: find first enabled model globally
  const m = await prisma.providerModel.findFirst({
    where: { modelId: requested, isEnabled: true, provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (m) return { provider: m.provider, model: m };
  return null;
}

// ─── Error Response Helpers ──────────────────────────────────────────────────

/**
 * Return an OpenAI-compatible error response.
 */
export function openaiError(
  message: string,
  type = "invalid_request_error",
  status = 400
) {
  return NextResponse.json(
    {
      error: {
        message,
        type,
        param: null,
        code: null,
      },
    },
    { status }
  );
}

/**
 * Return a KIE-compatible error response (used by /api/v1/jobs/*).
 */
export function kieError(message: string, code = 400) {
  return NextResponse.json(
    {
      code,
      msg: message,
      data: null,
    },
    { status: code }
  );
}

// ─── Billing Wrapper ─────────────────────────────────────────────────────────

/**
 * Charge a user for model usage, logging the event.
 * Wraps chargeUserWithSubscription with error handling so individual billing
 * failures do not crash the request handler.
 */
export async function chargeUser(
  prisma: ReturnType<typeof getPrisma>,
  apiKeyId: string,
  userId: string,
  providerSlug: string,
  modelId: string,
  totalTokens: number,
  cost: number
) {
  await chargeUserWithSubscription({
    apiKeyId,
    userId,
    providerSlug,
    modelId,
    totalTokens,
    cost,
  });
}

// ─── Admin Authorization ─────────────────────────────────────────────────────

/**
 * Verify the current session belongs to an admin user.
 * Returns the Prisma client on success, or throws an error.
 */
export async function ensureAdmin(): Promise<ReturnType<typeof getPrisma>> {
  const prisma = getPrisma();
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  let dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  // Fallback: lookup by email in case session.user.id is missing
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

// ─── Cost Calculation Helpers ────────────────────────────────────────────────

export function computeCost(
  promptTokens: number,
  completionTokens: number,
  model: { inputPricePer1k: number; outputPricePer1k: number }
): number {
  return (
    (promptTokens / 1000) * model.inputPricePer1k +
    (completionTokens / 1000) * model.outputPricePer1k
  );
}

export function computeCostFloor(
  promptTokens: number,
  completionTokens: number,
  model: { costInputPer1k: number; costOutputPer1k: number }
): number {
  return (
    (promptTokens / 1000) * model.costInputPer1k +
    (completionTokens / 1000) * model.costOutputPer1k
  );
}

export function estimatePromptTokens(body: OpenAIChatBody): number {
  // Very rough: ~1 token per 4 chars of text
  let chars = 0;
  for (const m of body.messages || []) {
    if (typeof m.content === "string") chars += m.content.length;
    else if (Array.isArray(m.content)) {
      for (const p of m.content) if (p && typeof (p as any).text === "string") chars += (p as any).text.length;
    }
  }
  return Math.max(1, Math.ceil(chars / 4));
}
