import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { AlipaySdk } from 'alipay-sdk';
import { getAlipayConfig } from '@/lib/payment-config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const prisma = getPrisma();
  
  try {
    const config = await getAlipayConfig();
    if (!config.appId || !config.privateKey) {
      console.error("[ALIPAY NOTIFY] Alipay is not configured. Cannot verify signature.");
      return new NextResponse('fail', { status: 500 });
    }

    const alipaySdk = new AlipaySdk({
      appId: config.appId,
      privateKey: config.privateKey,
      alipayPublicKey: config.alipayPublicKey || undefined,
      gateway: 'https://openapi.alipay.com/gateway.do',
      timeout: 5000,
      camelcase: true
    });

    // Alipay sends form-urlencoded data to the notify URL
    const textData = await req.text();
    const searchParams = new URLSearchParams(textData);
    const postData: Record<string, string> = {};
    
    searchParams.forEach((value, key) => {
      postData[key] = value;
    });

    // 1. Verify the signature to ensure it actually came from Alipay
    const isValid = alipaySdk.checkNotifySign(postData);

    if (!isValid) {
      console.warn("Alipay signature verification failed.");
      return new NextResponse('fail', { status: 400 });
    }

    // 2. Extract transaction details
    const outTradeNo = postData.out_trade_no;
    const tradeStatus = postData.trade_status;
    const totalAmount = parseFloat(postData.total_amount);

    // 3. Process the top-up if successful
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // Find the pending transaction
      const transaction = await prisma.billingTransaction.findFirst({
        where: { providerId: outTradeNo, status: 'PENDING' }
      });

      if (transaction) {
        // Complete transaction and add to balance
        await prisma.$transaction([
          prisma.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: totalAmount } }
          }),
          prisma.billingTransaction.update({
            where: { id: transaction.id },
            data: { status: 'SUCCESS' }
          })
        ]);
        console.log(`[ALIPAY] Successfully topped up ${totalAmount} for user ${transaction.userId}`);
      } else {
        // Just acknowledging it if we already processed it
      }
    }

    // Must return text "success" to alipay so it stops retrying
    return new NextResponse('success', { status: 200 });

  } catch (error) {
    console.error("Alipay Notify Error", error);
    return new NextResponse('fail', { status: 500 });
  }
}

