import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { type Locale } from "@/lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Helper to resolve locale on server side
async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("locale")?.value;
    if (cookieLocale === "zh" || cookieLocale === "en") {
      return cookieLocale;
    }
    const reqHeaders = await headers();
    const acceptLang = reqHeaders.get("accept-language") || "";
    return acceptLang.toLowerCase().startsWith("zh") ? "zh" : "en";
  } catch (e) {
    return "en";
  }
}

// Generate bilingual metadata dynamically based on resolved language
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";

  return {
    metadataBase: new URL(process.env.NEXTAUTH_URL || "https://aapi.togomol.com"),
    title: {
      default: isZh ? "AggregatAPI — 单一接口，无限大模型" : "AggregatAPI — One API, Infinite Models",
      template: "%s | AggregatAPI"
    },
    description: isZh
      ? "自动将请求智能路由到最优 AI 大模型。内置计费系统、开发者密钥管理和数据分析，完全兼容 OpenAI 接口规范。"
      : "Route your requests to the best AI models automatically. Built-in billing, developer keys management, and analytics with full OpenAI compatibility.",
    keywords: isZh
      ? [
          "AI API 聚合",
          "大模型路由",
          "API 聚合网关",
          "兼容 OpenAI",
          "DeepSeek 接口",
          "ChatGPT 聚合",
          "Claude 接口",
          "AI 计费网关",
          "AggregatAPI"
        ]
      : [
          "AI API",
          "API Aggregator",
          "LLM Routing",
          "OpenAI Compatibility",
          "DeepSeek API",
          "ChatGPT API",
          "Claude API",
          "AI Billing Gateway",
          "AggregatAPI"
        ],
    authors: [{ name: "AggregatAPI Team" }],
    creator: "AggregatAPI",
    publisher: "AggregatAPI",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1
      }
    },
    openGraph: {
      type: "website",
      locale: isZh ? "zh_CN" : "en_US",
      url: "https://aapi.togomol.com",
      title: isZh ? "AggregatAPI — 单一接口，集成与智能路由全部大模型" : "AggregatAPI — One API, Infinite AI Models",
      description: isZh
        ? "内置智能路由与计费系统，完全兼容 OpenAI 规范的 API 聚合服务网关。"
        : "Built-in intelligent routing, billing, and API keys. Compatible with OpenAI standards.",
      siteName: "AggregatAPI",
      images: [
        {
          url: "/logo.jpg",
          width: 512,
          height: 512,
          alt: "AggregatAPI Logo"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: isZh ? "AggregatAPI — 单一接口，集成与智能路由全部大模型" : "AggregatAPI — One API, Infinite AI Models",
      description: isZh
        ? "内置智能路由与计费系统，完全兼容 OpenAI 规范的 API 聚合服务网关。"
        : "Built-in intelligent routing, billing, and API keys. Compatible with OpenAI standards.",
      images: ["/logo.jpg"]
    },
    icons: {
      icon: "/logo.jpg",
      shortcut: "/logo.jpg",
      apple: "/logo.jpg"
    },
    alternates: {
      canonical: "/",
      languages: {
        "en-US": "/?lang=en",
        "zh-CN": "/?lang=zh"
      }
    }
  };
}

import { Providers } from "@/components/providers";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Providers initialLocale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
