"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { dictionaries, type Locale, type Dictionary } from "./i18n";

interface LangContextType {
  locale: Locale;
  t: Dictionary;
  setLocale: (l: Locale) => void;
}

const LangContext = createContext<LangContextType>({
  locale: "en",
  t: dictionaries.en,
  setLocale: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && dictionaries[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (mounted) localStorage.setItem("locale", l);
  };

  return (
    <LangContext.Provider
      value={{ locale, t: dictionaries[locale], setLocale }}
    >
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
