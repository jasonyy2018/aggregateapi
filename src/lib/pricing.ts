/**
 * Shared pricing helpers.
 *
 *  cost*    = what the platform pays to the upstream provider
 *  price*   = what the end-user is charged
 *  margin   = (price - cost) / cost     (undefined when cost = 0)
 */

import type { PrismaClient } from "@prisma/client";

export type PricePair = {
  costInputPer1k: number;
  costOutputPer1k: number;
  inputPricePer1k: number;
  outputPricePer1k: number;
};

/** Blended margin over a weighted (input=1, output=3) average. Returns 0..Infinity or null. */
export function computeMargin(p: PricePair): number | null {
  // Weight output 3x (typical OpenAI-style pricing ratio) so the margin reflects real revenue.
  const w = (inp: number, out: number) => inp * 1 + out * 3;
  const cost = w(p.costInputPer1k, p.costOutputPer1k);
  const price = w(p.inputPricePer1k, p.outputPricePer1k);
  if (cost <= 0) return null; // Unknown cost -> margin unknown
  return (price - cost) / cost;
}

/** Apply a margin factor to cost to produce selling prices. */
export function applyMargin(
  costInput: number,
  costOutput: number,
  marginPct: number
): { inputPricePer1k: number; outputPricePer1k: number } {
  const m = 1 + marginPct;
  return {
    inputPricePer1k: round4(costInput * m),
    outputPricePer1k: round4(costOutput * m),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Load or lazily create the platform settings singleton. */
export async function getPlatformSettings(prisma: PrismaClient) {
  let s = await prisma.platformSetting.findUnique({ where: { id: "singleton" } });
  if (!s) {
    s = await prisma.platformSetting.create({
      data: { id: "singleton" },
    });
  }
  return s;
}
