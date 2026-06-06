"use client";

import { ThemeProvider } from "@/lib/theme-context";
import { LangProvider } from "@/lib/lang-context";
import { type ReactNode } from "react";

import { type Locale } from "@/lib/i18n";

export function Providers({ 
  children,
  initialLocale = "en"
}: { 
  children: ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <ThemeProvider>
      <LangProvider initialLocale={initialLocale}>{children}</LangProvider>
    </ThemeProvider>
  );
}
