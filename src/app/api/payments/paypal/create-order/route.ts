import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getPaypalConfig } from '@/lib/payment-config';

export const dynamic = 'force-dynamic';

// Helper to generate access token
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

    const { amount } = await req.json();

    const accessToken = await generateAccessToken(config.clientId, config.clientSecret, config.baseUrl);
    const url = `${config.baseUrl}/v2/checkout/orders`;
    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount,
          },
        },
      ],
    };

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // Ideally, create a PENDING transaction in our DB here
    await prisma.billingTransaction.create({
      data: {
        userId: session.user.id!,
        amount: parseFloat(amount),
        type: 'TOPUP',
        status: 'PENDING',
        providerId: data.id,
      }
    });

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
