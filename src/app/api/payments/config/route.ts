import { NextResponse } from 'next/server';
import { getPaypalConfig } from '@/lib/payment-config';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getPaypalConfig();
    
    // We only return the ClientID and Mode, NEVER the secret to the client.
    return NextResponse.json({
      paypalClientId: config.clientId,
      paypalMode: config.mode,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
