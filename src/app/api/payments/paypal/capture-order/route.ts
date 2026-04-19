import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getPaypalConfig } from '@/lib/payment-config';

export const dynamic = 'force-dynamic';

async function generateAccessToken(clientId: string, clientSecret: string, baseUrl: string) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PayPal Auth Failed: ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const config = await getPaypalConfig();
    if (!config.clientId || !config.clientSecret) {
      throw new Error("PayPal credentials not configured");
    }

    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderID } = await req.json();

    const accessToken = await generateAccessToken(config.clientId, config.clientSecret, config.baseUrl);
    const url = `${config.baseUrl}/v2/checkout/orders/${orderID}/capture`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (data.status === "COMPLETED") {
      // Find the pending transaction
      const tx = await prisma.billingTransaction.findFirst({
        where: { providerId: orderID, status: 'PENDING' }
      });

      if (tx) {
        // Update transaction and increment balance
        await prisma.$transaction([
          prisma.billingTransaction.update({
            where: { id: tx.id },
            data: { status: 'SUCCESS' }
          }),
          prisma.user.update({
             where: { id: tx.userId },
             data: { balance: { increment: tx.amount } }
          })
        ]);
      }
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
