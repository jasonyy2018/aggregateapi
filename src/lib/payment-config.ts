import { getPrisma } from "./prisma";
import { decryptSecret } from "./crypto";

export async function getPaypalConfig() {
  const prisma = getPrisma();
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "singleton" },
    select: {
      paypalClientId: true,
      paypalSecretCipher: true,
    },
  });

  const clientId = settings?.paypalClientId || process.env.PAYPAL_CLIENT_ID;
  let clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (settings?.paypalSecretCipher) {
    try {
      clientSecret = decryptSecret(settings.paypalSecretCipher);
    } catch (e) {
      console.error("[payment-config] Failed to decrypt PayPal secret:", e);
    }
  }

  const isProd = process.env.NODE_ENV === "production";
  const baseUrl = isProd ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  return {
    clientId,
    clientSecret,
    baseUrl,
  };
}

export async function getAlipayConfig() {
    const prisma = getPrisma();
    const settings = await prisma.platformSetting.findUnique({
      where: { id: "singleton" },
      select: {
        alipayAppId: true,
        alipayPublicKey: true,
        alipayPrivateKeyCipher: true,
      },
    });
  
    const appId = settings?.alipayAppId || process.env.ALIPAY_APP_ID;
    const publicKey = settings?.alipayPublicKey || process.env.ALIPAY_PUBLIC_KEY;
    let privateKey = process.env.ALIPAY_PRIVATE_KEY;
  
    if (settings?.alipayPrivateKeyCipher) {
      try {
        privateKey = decryptSecret(settings.alipayPrivateKeyCipher);
      } catch (e) {
        console.error("[payment-config] Failed to decrypt Alipay private key:", e);
      }
    }
  
    return {
      appId,
      publicKey,
      privateKey,
    };
  }
