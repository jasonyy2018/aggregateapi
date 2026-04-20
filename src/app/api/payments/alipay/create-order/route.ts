import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { AlipaySdk } from 'alipay-sdk';
import { getAlipayConfig } from '@/lib/payment-config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const prisma = getPrisma();
  
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();
    if (!amount) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 });
    }

    const config = await getAlipayConfig();

    if (!config.appId || !config.privateKey) {
      console.error("[ALIPAY] Configuration missing:", { 
        hasAppId: !!config.appId, 
        hasPrivateKey: !!config.privateKey,
        hasPublicKey: !!config.alipayPublicKey 
      });
      return NextResponse.json({ error: "Alipay is not fully configured. Please check your admin settings (App ID and Private Key are required)." }, { status: 500 });
    }

    console.log("[ALIPAY] Initializing SDK with AppID:", config.appId);

    const alipaySdk = new AlipaySdk({
      appId: config.appId,
      privateKey: config.privateKey,
      alipayPublicKey: config.alipayPublicKey || undefined,
      gateway: 'https://openapi.alipay.com/gateway.do',
      timeout: 10000,
      camelcase: true
    });

    // Create tracking order id
    const outTradeNo = `ORDER_${Date.now()}_${session.user.id?.substring(0, 5)}`;
    console.log("[ALIPAY] Creating order:", outTradeNo, "Amount:", amount);

    // Optional: create a PENDING transaction locally
    await prisma.billingTransaction.create({
      data: {
        userId: session.user.id!,
        amount: parseFloat(amount),
        type: 'TOPUP',
        status: 'PENDING',
        providerId: outTradeNo, 
      }
    });


    // Dynamically determine URLs based on request origin
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const notifyUrl = `${origin}/api/payments/alipay/notify`;
    const returnUrl = `${origin}/dashboard/billing`;

    console.log("[ALIPAY] Executing alipay.trade.page.pay using pageExec...");

    // In Alipay SDK v4, pageExec is the recommended way for page payments
    // Adding method: 'GET' ensures we get a URL instead of an HTML form string
    const resultUrl = await alipaySdk.pageExec(
      'alipay.trade.page.pay',
      {
        method: 'GET',
        bizContent: {
          outTradeNo: outTradeNo,
          productCode: 'FAST_INSTANT_TRADE_PAY',
          totalAmount: amount.toString(),
          subject: 'AggregatAPI Top-up',
          body: 'API Gateway Account Balance Top-up',
        },
        notifyUrl: notifyUrl,
        returnUrl: returnUrl,
      }
    );


    if (!resultUrl) {
      throw new Error("Alipay SDK failed to generate a payment URL.");
    }

    console.log("[ALIPAY] Order created successfully via pageExec.");
    return NextResponse.json({ url: resultUrl });

  } catch (err: any) {
    console.error("Alipay Create Order Error:", err);
    // If Alipay returns a specific error code in the message, it's very helpful
    const errorMessage = err.message || "Internal Server Error during Alipay order creation";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}


