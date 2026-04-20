import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { AlipaySdk, AlipayFormData } from 'alipay-sdk';
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
      return NextResponse.json({ error: "Alipay is not fully configured. Please check your admin settings." }, { status: 500 });
    }

    const alipaySdk = new AlipaySdk({
      appId: config.appId,
      privateKey: config.privateKey,
      alipayPublicKey: config.alipayPublicKey || undefined,
      gateway: 'https://openapi.alipay.com/gateway.do',
      timeout: 5000,
      camelcase: true
    });

    // Create tracking order id
    const outTradeNo = `ORDER_${Date.now()}_${session.user.id?.substring(0, 5)}`;

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

    // Create a page.pay URL
    const formData = new AlipayFormData();
    
    // Dynamically determine URLs based on request origin
    const origin = req.headers.get('origin') || new URL(req.url).origin;
    const notifyUrl = `${origin}/api/payments/alipay/notify`;
    const returnUrl = `${origin}/dashboard/billing`;

    formData.setMethod('get');
    formData.addField('notifyUrl', notifyUrl);
    formData.addField('returnUrl', returnUrl);
    
    formData.addField('bizContent', {
      outTradeNo: outTradeNo,
      productCode: 'FAST_INSTANT_TRADE_PAY',
      totalAmount: amount.toString(),
      subject: 'AggregatAPI Top-up',
      body: 'API Gateway Account Balance Top-up',
    });

    // Executes and retrieves a URL back since we specify 'get'
    const resultUrl = await alipaySdk.exec(
      'alipay.trade.page.pay',
      {},
      { formData }
    );

    return NextResponse.json({ url: resultUrl as unknown as string });
  } catch (err: any) {
    console.error("Alipay Create Order Error:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error during Alipay order creation" }, { status: 500 });
  }
}

