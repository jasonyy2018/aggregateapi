import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const PAYPAL_CLIENT = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const IS_PROD = process.env.NODE_ENV === "production";
const base = IS_PROD ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

async function generateAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const data = await response.json();
  return data.access_token;
}

export async function POST(req: Request) {
  const prisma = getPrisma();
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderID } = await req.json();

    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders/${orderID}/capture`;

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
