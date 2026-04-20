import { getPrisma } from "./prisma";
import { decryptSecret } from "./crypto";

export async function getPaypalConfig() {
  const prisma = getPrisma();
  const settings = await prisma.platformSetting.findUnique({
    where: { id: "singleton" },
    select: {
      paypalMode: true,
      paypalClientId: true,
      paypalSecretCipher: true,
    },
  });

  const mode = settings?.paypalMode || (process.env.NODE_ENV === "production" ? "live" : "sandbox");
  const clientId = settings?.paypalClientId?.trim() || process.env.PAYPAL_CLIENT_ID?.trim();
  let clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();

  if (settings?.paypalSecretCipher) {
    try {
      clientSecret = decryptSecret(settings.paypalSecretCipher).trim();
    } catch (e) {
      console.error("[payment-config] Failed to decrypt PayPal secret:", e);
    }
  }

  const baseUrl = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

  return {
    mode,
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

  const appId = settings?.alipayAppId?.trim() || process.env.ALIPAY_APP_ID?.trim();
  const alipayPublicKey = settings?.alipayPublicKey?.trim() || process.env.ALIPAY_PUBLIC_KEY?.trim();
  let privateKey = process.env.ALIPAY_PRIVATE_KEY?.trim();

  if (settings?.alipayPrivateKeyCipher) {
    try {
      privateKey = decryptSecret(settings.alipayPrivateKeyCipher).trim();
    } catch (e) {
      console.error("[payment-config] Failed to decrypt Alipay private key:", e);
    }
  }

  return {
    appId,
    alipayPublicKey,
    privateKey,
  };
}

