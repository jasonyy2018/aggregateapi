import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { AlipaySdk, AlipayFormData } from 'alipay-sdk';
// Wait, ALipaySDK v3 handles it directly or with AlipayFormData

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const prisma = getPrisma();
  const alipaySdk = new AlipaySdk({
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gateway: 'https://openapi.alipay.com/gateway.do',
    timeout: 5000,
    camelcase: true
  });
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount } = await req.json();

    if (!process.env.ALIPAY_APP_ID || !process.env.ALIPAY_PRIVATE_KEY) {
      return NextResponse.json({ error: "Alipay Gateway is not configured." }, { status: 500 });
    }

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
    
    formData.setMethod('get');
    formData.addField('notifyUrl', process.env.ALIPAY_WEBHOOK_URL || 'http://localhost:3000/api/payments/alipay/notify');
    formData.addField('returnUrl', 'http://localhost:3000/dashboard/billing');
    
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
