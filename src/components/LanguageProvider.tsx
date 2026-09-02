"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  type Locale,
  type MessageKey,
  locales,
  messages,
} from "@/i18n/messages";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("omcite-language-change", onStoreChange);
      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("omcite-language-change", onStoreChange);
      };
    },
    () => {
      const saved = window.localStorage.getItem("omcite-locale");
      return saved && locales.includes(saved as Locale) ? saved as Locale : "ru";
    },
    () => "ru" as Locale,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale: (nextLocale) => {
      window.localStorage.setItem("omcite-locale", nextLocale);
      window.dispatchEvent(new Event("omcite-language-change"));
    },
    t: (key) => messages[locale][key] ?? messages.ru[key],
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
